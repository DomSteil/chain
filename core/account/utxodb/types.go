package utxodb

import (
	"context"
	"errors"
	"time"

	"chain/protocol/bc"
)

var (
	// ErrInsufficient indicates the account doesn't contain enough
	// units of the requested asset to satisfy the reservation.
	// New units must be deposited into the account in order to
	// satisfy the request; change will not be sufficient.
	ErrInsufficient = errors.New("reservation found insufficient funds")

	// ErrReserved indicates that a reservation could not be
	// satisfied because some of the outputs were already reserved.
	// When those reservations are finalized into a transaction
	// (and no other transaction spends funds from the account),
	// new change outputs will be created
	// in sufficient amounts to satisfy the request.
	ErrReserved = errors.New("reservation found outputs already reserved")
)

type (
	UTXO struct {
		bc.Outpoint
		bc.AssetAmount
		Script []byte

		AccountID           string
		ControlProgramIndex uint64
	}

	// Change represents reserved units beyond what was asked for.
	// Total reservation is for Amount+Source.Amount.
	Change struct {
		Source Source
		Amount uint64
	}

	Source struct {
		AssetID     bc.AssetID `json:"asset_id"`
		AccountID   string     `json:"account_id"`
		TxHash      *bc.Hash
		OutputIndex *uint32
		Amount      uint64
		ClientToken *string `json:"client_token"`
	}

	Reserver interface {
		Reserve(context.Context, Source, time.Time) (int32, []*UTXO, []Change, error)
		ReserveUTXO(context.Context, bc.Hash, uint32, *string, time.Time) (int32, *UTXO, error)
		Cancel(context.Context, int32) error
		ExpireReservations(context.Context) error
	}
)
