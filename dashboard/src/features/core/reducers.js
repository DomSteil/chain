import { combineReducers } from 'redux'
import { testNetUrl } from 'utility/environment'
import moment from 'moment'
import { DeltaSampler } from 'utility/time'

const LONG_TIME_FORMAT = 'YYYY-MM-DD, h:mm:ss a'

const coreConfigReducer = (key, state, defaultState, action) => {
  if (action.type == 'UPDATE_CORE_INFO') {
    return action.param[key] || defaultState
  }

  return state || defaultState
}

export const configured = (state, action) =>
  coreConfigReducer('is_configured', state, false, action)
export const configuredAt = (state, action) => {
  let value = coreConfigReducer('configured_at', state, '', action)
  if (action.type == 'UPDATE_CORE_INFO' && value != '') {
    value = moment(value).format(LONG_TIME_FORMAT)
  }
  return value
}
export const buildCommit = (state, action) => {
  let value = coreConfigReducer('build_commit', state, '', action)
  if (value === '?') {
    value = 'Local development'
  } else if (value != '') {
    value = value.substring(0,18)
  }
  return value
}
export const buildDate = (state, action) => {
  let value = coreConfigReducer('build_date', state, '', action)
  if (value !== '') {
    value = moment(value, 'X').format(LONG_TIME_FORMAT)
  }

  return value
}
export const production = (state, action) =>
  coreConfigReducer('is_production', state, false, action)
export const blockHeight = (state, action) =>
  coreConfigReducer('block_height', state, 0, action)
export const generatorBlockHeight = (state, action) => {
  if (action.type == 'UPDATE_CORE_INFO') {
    if (action.param.generator_block_height == null) return '???'
  }

  return coreConfigReducer('generator_block_height', state, 0, action)
}
export const signer = (state, action) =>
  coreConfigReducer('is_signer', state, false, action)
export const generator = (state, action) =>
  coreConfigReducer('is_generator', state, false, action)
export const generatorUrl = (state, action) =>
  coreConfigReducer('generator_url', state, false, action)
export const generatorAccessToken = (state, action) =>
  coreConfigReducer('generator_access_token', state, false, action)
export const blockchainID = (state, action) =>
  coreConfigReducer('blockchain_id', state, 0, action)
export const networkRpcVersion = (state, action) =>
  coreConfigReducer('network_rpc_version', state, 0, action)

export const coreType = (state = '', action) => {
  if (action.type == 'UPDATE_CORE_INFO') {
    if (action.param.is_generator) return 'Generator'
    if (action.param.is_signer) return 'Signer'
    return 'Participant'
  }
  return state
}

export const replicationLag = (state = null, action) => {
  if (action.type == 'UPDATE_CORE_INFO') {
    if (action.param.generator_block_height == null) {
      return '???'
    }
    return action.param.generator_block_height - action.param.block_height + ''
  }

  return state
}

let syncSamplers = null
const resetSyncEstimators = () => {
  syncSamplers = {
    snapshot: new DeltaSampler({sampleTtl: 10 * 1000}),
    replicaLag: new DeltaSampler({sampleTtl: 10 * 1000}),
  }
}

export const syncEstimates = (state = {}, action) => {
  switch (action.type) {
    case 'UPDATE_CORE_INFO': {
      if (!syncSamplers) {
        resetSyncEstimators()
      }

      const {
        snapshot,
        generator_block_height,
        block_height,
      } = action.param

      const estimates = {}

      if (snapshot && snapshot.in_progress) {
        const speed = syncSamplers.snapshot.sample(snapshot.downloaded)

        if (speed != 0) {
          estimates.snapshot = (snapshot.size - snapshot.downloaded) / speed
        }
      } else {
        const replicaLag = generator_block_height - block_height
        const speed = syncSamplers.replicaLag.sample(replicaLag)

        if (speed != 0) {
          const duration = -1 * replicaLag / speed
          if (duration > 0) {
            estimates.replicaLag = duration
          }
        }
      }

      return estimates
    }

    case 'CORE_DISCONNECT':
    case 'USER_LOG_OUT':
      resetSyncEstimators()
      return {}

    default:
      return state
  }
}

export const replicationLagClass = (state = null, action) => {
  if (action.type == 'UPDATE_CORE_INFO') {
    if (action.param.generator_block_height == null) {
      return 'red'
    } else {
      let lag = action.param.generator_block_height - action.param.block_height
      if (lag < 5) {
        return 'green'
      } else if (lag < 10) {
        return 'yellow'
      } else {
        return 'red'
      }
    }
  }

  return state
}

export const onTestNet = (state = false, action) => {
  if (action.type == 'UPDATE_CORE_INFO') {
    return (action.param.generator_url || '').indexOf(testNetUrl) >= 0
  }

  return state
}

export const requireClientToken = (state = false, action) => {
  if (action.type == 'ERROR' && action.payload.status == 401) return true

  return state
}

export const clientToken = (state = '', action) => {
  if      (action.type == 'SET_CLIENT_TOKEN') return action.token
  else if (action.type == 'USER_LOG_OUT')     return ''
  else if (action.type == 'ERROR' &&
           action.payload.status == 401)      return ''

  return state
}

export const validToken = (state = false, action) => {
  if      (action.type == 'SET_CLIENT_TOKEN') return false
  else if (action.type == 'USER_LOG_IN')      return true
  else if (action.type == 'USER_LOG_OUT')     return false
  else if (action.type == 'ERROR' &&
           action.payload.status == 401)      return false

  return state
}

export const connected = (state = true, action) => {
  if      (action.type == 'UPDATE_CORE_INFO') return true
  else if (action.type == 'CORE_DISCONNECT')  return false

  return state
}

const snapshot = (state = null, action) => {
  if (action.type == 'UPDATE_CORE_INFO') {
    return action.param.snapshot || null // snapshot may be undefined, which Redux doesn't like.
  }
  return state
}

export default combineReducers({
  blockchainID,
  blockHeight,
  buildCommit,
  buildDate,
  connected,
  clientToken,
  configured,
  configuredAt,
  coreType,
  generator,
  generatorAccessToken,
  generatorBlockHeight,
  generatorUrl,
  networkRpcVersion,
  onTestNet,
  production,
  replicationLag,
  replicationLagClass,
  requireClientToken,
  signer,
  snapshot,
  syncEstimates,
  validToken,
})
