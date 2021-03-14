import * as etch from 'etch'
import * as UPI from 'atom-haskell-upi'
import { TextEditor } from 'atom'
import { handlePromise } from '../utils'

export async function renderActions(
  editor: TextEditor,
  actions?: () => Promise<UPI.Action[] | undefined>,
): Promise<JSX.Element | undefined> {
  if (!actions) return undefined
  const act = await actions()
  if (!act) return undefined
  if (!act.length) return undefined
  const maxActions = 8
  return (
    <ide-haskell-tooltip-actions>
      {act.slice(0, maxActions).map((act) => (
        <button
          className="btn btn-xs"
          on={{ click: () => handlePromise(act.apply()) }}
        >
          {act.title}
        </button>
      ))}
      {act.length > maxActions ? (
        <button className="btn btn-xs" on={{ click: click(editor) }}>
          …
        </button>
      ) : // tslint:disable-next-line: no-null-keyword
      null}
    </ide-haskell-tooltip-actions>
  )
}

function click(editor: TextEditor) {
  return function() {
    atom.commands.dispatch(
      atom.views.getView(editor),
      'ide-haskell:show-actions',
    )
  }
}
