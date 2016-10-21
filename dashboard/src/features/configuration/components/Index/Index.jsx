import { reduxForm } from 'redux-form'
import { TextField } from 'components/Common'
import { ErrorBanner } from 'features/shared/components'
import pick from 'lodash.pick'
import actions from 'actions'
import InlineSVG from 'svg-inline-react'
import React from 'react'
import styles from './Index.scss'

class Index extends React.Component {
  constructor(props) {
    super(props)

    this.submitWithValidation = this.submitWithValidation.bind(this)
  }

  showNewFields() {
    return this.props.fields.type.value === 'new'
  }

  showJoinFields() {
    return this.props.fields.type.value === 'join'
  }

  showTestNetFields() {
    return this.props.fields.type.value === 'testnet'
  }

  submitWithValidation(data) {
    if (data.generator_url && !data.blockchain_id) {
      return new Promise((_, reject) => reject({
        _error: 'You must specify a blockchain ID to connect to a network'
      }))
    }

    return new Promise((resolve, reject) => {
      this.props.submitForm(data)
        .catch((err) => reject({type: err.message}))
    })
  }

  render() {
    const {
      fields: {
        type,
        generator_url,
        generator_access_token,
        blockchain_id
      },
      handleSubmit,
      submitting,
    } = this.props

    const typeChange = (event) => {
      const value = type.onChange(event).value

      if (value != 'join') {
        generator_url.onChange('')
        generator_access_token.onChange('')
        blockchain_id.onChange('')
      }
    }

    const typeProps = {
      ...pick(type, ['name', 'value', 'checked', 'onBlur', 'onFocus']),
      onChange: typeChange
    }

    let configSubmit = [
      (type.error && <ErrorBanner
        key='configError'
        title='There was a problem configuring your core:'
        message={type.error}
      />),
      <button
        key='configSubmit'
        type='submit'
        className={`btn btn-primary btn-lg ${styles.submit}`}
        disabled={submitting}>
          <span className='glyphicon glyphicon-arrow-right' />
          &nbsp;{this.showNewFields() ? 'Create' : 'Join'} network
      </button>
    ]

    return (
      <form onSubmit={handleSubmit(this.submitWithValidation)}>
        <h2 className={styles.title}>Select a blockchain configuration</h2>
        <h3 className={styles.subtitle}>You can reset your Chain Core at any time to change these settings</h3>

        <div className={styles.choices}>
          <div className={styles.choice_wrapper}>
            <label>
              <input className={styles.choice_radio_button}
                    type='radio'
                    {...typeProps}
                    value='new' />
              <div className={styles.choice}>
                <InlineSVG src={require('!svg-inline!assets/images/config/create-new.svg')} />
                <span className={styles.choice_title}>Create new blockchain network</span>

                <p>
                  Start a new blockchain network with this Chain Core as the block generator.
                </p>
              </div>
            </label>
          </div>

          <div className={styles.choice_wrapper}>
            <label>
              <input className={styles.choice_radio_button}
                    type='radio'
                    {...typeProps}
                    value='join' />
              <div className={styles.choice}>
                <InlineSVG src={require('!svg-inline!assets/images/config/join-existing.svg')} />
                  <span className={styles.choice_title}>Join existing blockchain network</span>

                  <p>
                    Connect this Chain Core to an existing blockchain network.
                  </p>
              </div>
            </label>
          </div>

          <div className={styles.choice_wrapper}>
            <label>
              <input className={styles.choice_radio_button}
                    type='radio'
                    {...typeProps}
                    value='testnet' />
              <div className={styles.choice}>
                <InlineSVG src={require('!svg-inline!assets/images/config/join-existing.svg')} />
                  <span className={styles.choice_title}>Join the Chain Testnet</span>

                  <p>
                    Connect this Chain Core to the Chain Testnet.
                    <br />
                    Data will be reset every week.
                  </p>
              </div>
            </label>
          </div>
        </div>

        <div className={styles.choices}>
          <div className={styles.choice_wrapper}>
            {this.showNewFields() && configSubmit}
          </div>

          <div className={styles.choice_wrapper}>
            {this.showJoinFields() && <div className={styles.joinFields}>
              <TextField
                title='Block Generator URL'
                placeholder='https://<block-generator-host>'
                fieldProps={generator_url} />
              <TextField
                title='Generator Access Token'
                placeholder='token-id:9e5f139755366add8c76'
                fieldProps={generator_access_token} />
              <TextField
                title='Blockchain ID'
                placeholder='896a800000000000000'
                fieldProps={blockchain_id} />

              {configSubmit}
            </div>}
          </div>

          <div className={styles.choice_wrapper}>
            {this.showTestNetFields() && configSubmit}
          </div>
        </div>
      </form>
    )
  }
}

const mapStateToProps = (state) => ({
  testNetInfo: state.configuration.testNetInfo
})

const mapDispatchToProps = (dispatch) => ({
  fetchTestNetInfo: () => dispatch(actions.configuration.fetchTestNetInfo()),
  submitForm: (data) => dispatch(actions.configuration.submitConfiguration(data))
})

const config = {
  form: 'coreConfigurationForm',
  fields: [
    'type',
    'generator_url',
    'generator_access_token',
    'blockchain_id'
  ]
}

export default reduxForm(
  config,
  mapStateToProps,
  mapDispatchToProps
)(Index)
