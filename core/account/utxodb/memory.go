package utxodb

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"chain/database/pg"
	"chain/errors"
	"chain/protocol/bc"
)

func NewMemoryReserver(db pg.DB) *MemoryReserver {
	return &MemoryReserver{
		db:           db,
		reservations: make(map[int32]reservation),
		accounts:     make(map[string]*accountReserver),
	}
}

type reservation struct {
	accountID string
	utxos     []*UTXO
	expiry    time.Time
}

// MemoryReserver implements a UTXO reserver that stores reservations
// in-memory. It relies on the account_utxos table for the source of
// truth of valid UTXOs, but tracks which of those UTXOs are reserved
// in-memory.
//
// To reduce latency and prevent deadlock, no two mutexs (either on
// MemoryReserver or accountReserver) should be held at the same time.
type MemoryReserver struct {
	db                pg.DB
	nextReservationID int32

	reservationsMu sync.Mutex
	reservations   map[int32]reservation

	accountsMu sync.Mutex
	accounts   map[string]*accountReserver
}

func (mr *MemoryReserver) Reserve(ctx context.Context, source Source, exp time.Time) (reservationID int32, u []*UTXO, c []Change, err error) {
	// Find the set of UTXOs that match this source.
	utxos, err := mr.findMatchingUTXOs(ctx, source)
	if err != nil {
		return 0, nil, nil, err
	}

	// Try to reserve the right amount.
	rid := atomic.AddInt32(&mr.nextReservationID, 1)
	reserved, total, err := mr.account(source.AccountID).reserve(rid, source, utxos)
	if err != nil {
		return 0, nil, nil, err
	}

	// Save the successful reservation.
	mr.reservationsMu.Lock()
	defer mr.reservationsMu.Unlock()

	res := reservation{
		accountID: source.AccountID,
		utxos:     reserved,
		expiry:    exp,
	}
	mr.reservations[rid] = res

	// Make change if necessary
	if total > source.Amount {
		c = append(c, Change{
			Source: source,
			Amount: total - source.Amount,
		})
	}
	return rid, reserved, c, nil
}

func (mr *MemoryReserver) ReserveUTXO(ctx context.Context, txHash bc.Hash, pos uint32, clientToken *string, exp time.Time) (int32, *UTXO, error) {
	utxo, err := mr.findSpecificUTXO(ctx, txHash, pos)
	if err != nil {
		return 0, nil, err
	}

	rid := atomic.AddInt32(&mr.nextReservationID, 1)
	err = mr.account(utxo.AccountID).reserveUTXO(rid, utxo)
	if err != nil {
		return 0, nil, err
	}

	mr.reservationsMu.Lock()
	mr.reservations[rid] = reservation{
		accountID: utxo.AccountID,
		utxos:     []*UTXO{utxo},
		expiry:    exp,
	}
	mr.reservationsMu.Unlock()

	return rid, utxo, nil
}

// Cancel makes a best-effort attempt at canceling the reservation with
// the provided id.
func (mr *MemoryReserver) Cancel(ctx context.Context, rid int32) error {
	mr.reservationsMu.Lock()
	res, ok := mr.reservations[rid]
	delete(mr.reservations, rid)
	mr.reservationsMu.Unlock()
	if !ok {
		return fmt.Errorf("couldn't find reservation %d", rid)
	}
	mr.account(res.accountID).cancel(res)
	return nil
}

func (mr *MemoryReserver) ExpireReservations(ctx context.Context) error {
	// Remove records of any reservations that have expired.
	now := time.Now()
	var canceled []reservation
	mr.reservationsMu.Lock()
	for rid, res := range mr.reservations {
		if res.expiry.Before(now) {
			canceled = append(canceled, res)
			delete(mr.reservations, rid)
		}
	}
	mr.reservationsMu.Unlock()

	// If we removed any expired reservations, update the corresponding
	// acount reservers.
	for _, res := range canceled {
		mr.account(res.accountID).cancel(res)
	}

	// Cleanup any account reservers that don't have anything reserved.
	mr.accountsMu.Lock()
	for accID, ar := range mr.accounts {
		if len(ar.reserved) == 0 {
			delete(mr.accounts, accID)
		}
	}
	mr.accountsMu.Unlock()
	return nil
}

func (mr *MemoryReserver) findMatchingUTXOs(ctx context.Context, source Source) ([]*UTXO, error) {
	const q = `
		SELECT tx_hash, index, amount, control_program_index, control_program, confirmed_in
		FROM account_utxos a
		WHERE account_id = $1 AND asset_id = $2
	`
	var utxos []*UTXO
	err := pg.ForQueryRows(ctx, mr.db, q, source.AccountID, source.AssetID,
		func(txHash bc.Hash, index uint32, amount uint64, cpIndex uint64, controlProg []byte, confirmedIn *uint64) {
			utxos = append(utxos, &UTXO{
				Outpoint: bc.Outpoint{
					Hash:  txHash,
					Index: index,
				},
				AssetAmount: bc.AssetAmount{
					Amount:  amount,
					AssetID: source.AssetID,
				},
				Script:              controlProg,
				AccountID:           source.AccountID,
				ControlProgramIndex: cpIndex,
			})
		})
	if err != nil {
		return nil, errors.Wrap(err)
	}
	return utxos, nil
}

func (mr *MemoryReserver) findSpecificUTXO(ctx context.Context, txHash bc.Hash, index uint32) (*UTXO, error) {
	const q = `
		SELECT account_id, asset_id, amount, control_program_index, control_program
		FROM account_utxos
		WHERE tx_hash = $1 AND index = $2
	`
	u := new(UTXO)
	err := mr.db.QueryRow(ctx, q, txHash, index).Scan(&u.AccountID, &u.AssetID, &u.Amount, &u.ControlProgramIndex, &u.Script)
	if err == sql.ErrNoRows {
		return nil, pg.ErrUserInputNotFound
	} else if err != nil {
		return nil, errors.Wrap(err)
	}
	u.Outpoint.Hash, u.Outpoint.Index = txHash, index
	return u, nil
}

func (mr *MemoryReserver) account(accID string) *accountReserver {
	mr.accountsMu.Lock()
	defer mr.accountsMu.Unlock()

	ar, ok := mr.accounts[accID]
	if ok {
		return ar
	}

	ar = &accountReserver{
		reserved: make(map[bc.Outpoint]int32),
	}
	mr.accounts[accID] = ar
	return ar
}

type accountReserver struct {
	mu       sync.Mutex
	reserved map[bc.Outpoint]int32
}

func (ar *accountReserver) reserve(rid int32, src Source, utxos []*UTXO) ([]*UTXO, uint64, error) {
	var reserved, unavailable uint64
	var reservedUTXOs []*UTXO

	ar.mu.Lock()
	defer ar.mu.Unlock()
	for _, utxo := range utxos {
		// If the UTXO is already reserved, skip it.
		if _, ok := ar.reserved[utxo.Outpoint]; ok {
			unavailable += utxo.Amount
			continue
		}

		// This UTXO is available for the taking.
		reserved += utxo.Amount
		reservedUTXOs = append(reservedUTXOs, utxo)
		if reserved >= src.Amount {
			break
		}
	}

	if reserved+unavailable < src.Amount {
		// Even everything was available, this account wouldn't have enough
		// to satisfy the request.
		return nil, 0, ErrInsufficient
	}
	if reserved < src.Amount {
		// The account has enough for the request, but it's all tied up in
		// other reservations.
		return nil, 0, ErrReserved
	}

	// We've found enough to satisfy the request.
	for _, utxo := range reservedUTXOs {
		ar.reserved[utxo.Outpoint] = rid
	}
	return reservedUTXOs, reserved, nil
}

func (ar *accountReserver) reserveUTXO(rid int32, utxo *UTXO) error {
	ar.mu.Lock()
	defer ar.mu.Unlock()

	_, isReserved := ar.reserved[utxo.Outpoint]
	if isReserved {
		return ErrReserved
	}

	ar.reserved[utxo.Outpoint] = rid
	return nil
}

func (ar *accountReserver) cancel(res reservation) {
	ar.mu.Lock()
	defer ar.mu.Unlock()
	for _, utxo := range res.utxos {
		delete(ar.reserved, utxo.Outpoint)
	}
}
