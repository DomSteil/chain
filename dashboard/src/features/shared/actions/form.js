import chain from 'chain'
import { context } from 'utility/environment'
import { parseNonblankJSON } from 'utility/string'
import actionCreator from './actionCreator'
import { push } from 'react-router-redux'

export default function(type, options = {}) {
  const listPath = options.listPath || `/${type}s`
  const createPath = options.createPath || `${listPath}/create`
  const created = actionCreator(`CREATED_${type.toUpperCase()}`, param => ({ param }) )
  let postCreatePath = listPath

  return {
    showCreate: push(createPath),
    created,
    submitForm: (data) => {
      const className = options.className || type.charAt(0).toUpperCase() + type.slice(1)

      const jsonFields = options.jsonFields || []
      jsonFields.map(fieldName => {
        data[fieldName] = parseNonblankJSON(data[fieldName])
      })

      const intFields = options.intFields || []
      intFields.map(fieldName => {
        data[fieldName] = parseInt(data[fieldName])
      })

      return function(dispatch) {
        let object = new chain[className](data)

        return object.create(context())
          .then((resp) => {
            if (options.redirectToShow) {
              postCreatePath = `${postCreatePath}/${resp.id}`
            }

            dispatch(created(resp))
            dispatch(push({
              pathname: postCreatePath,
              state: {
                preserveFlash: true
              }
            }))
          })
      }
    }
  }
}
