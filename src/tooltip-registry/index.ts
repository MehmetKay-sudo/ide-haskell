import { TextEditor, Disposable, Range } from 'atom'
import { MessageObject } from '../utils'
import { PluginManager } from '../plugin-manager'

export interface TTooltipHandlerSpec {
  priority: number
  handler: UPI.TTooltipHandler
  eventTypes?: UPI.TEventRangeType[]
}
export interface ITooltipSpec {
  pluginName: string
  tooltip: UPI.TTooltipFunction | UPI.ITooltipData
}

export class TooltipRegistry {
  private providers: Array<TTooltipHandlerSpec & { pluginName: string, eventTypes: UPI.TEventRangeType[] }>
  constructor(private pluginManager: PluginManager) {
    this.providers = []
  }

  public dispose() {
    this.providers = []
  }

  public register(pluginName: string, provider: TTooltipHandlerSpec): Disposable {
    const idx = this.providers.findIndex(({ priority }) => priority < provider.priority)
    const defaultEvT: UPI.TEventRangeType[] = [UPI.TEventRangeType.selection, UPI.TEventRangeType.mouse]
    const record = {
      pluginName,
      eventTypes: provider.eventTypes || defaultEvT,
      priority: provider.priority,
      handler: provider.handler,
    }
    if (idx === -1) {
      this.providers.push(record)
    } else {
      this.providers.splice(idx, 0, record)
    }
    return new Disposable(() => {
      const ix = this.providers.indexOf(record)
      this.providers.splice(ix, 1)
    })
  }

  public async showTooltip(
    editor: TextEditor, type: UPI.TEventRangeType, spec?: ITooltipSpec,
  ) {
    const controller = this.pluginManager.controller(editor)
    if (!controller) { return }
    let pluginName: string
    let tooltipData: UPI.TTooltipFunction | UPI.ITooltipData
    if (spec && typeof spec.tooltip !== 'function') {
      tooltipData = spec.tooltip
      pluginName = spec.pluginName
    } else {
      const eventRange = controller.getEventRange(type)
      if (!eventRange) { return }
      if (spec && typeof spec.tooltip === 'function') {
        pluginName = spec.pluginName
        try {
          tooltipData = await Promise.resolve(spec.tooltip(eventRange.crange))
        } catch (e) {
          this.pluginManager.backendStatus(spec.pluginName, {
            status: 'warning',
            // tslint:disable-next-line:no-unsafe-any
            detail: e.toString(),
          })
          return
        }
      } else {
        const tooltip = await this.defaultTooltipFunction(editor, type, eventRange.crange)
        if (!tooltip) {
          // if nobody wants to show anything, might as well hide...
          // TODO: this doesn't seem like a particularly bright idea?
          controller.tooltips.hide(type, undefined, { persistent: false })
          return
        }
        ({ pluginName, tooltipData } = tooltip)
      }
      const newEventRange = controller.getEventRange(type)
      if (!newEventRange || !eventRange.crange.isEqual(newEventRange.crange)) { return }
    }
    const { persistent = false } = tooltipData
    let msg
    if (Array.isArray(tooltipData.text)) {
      msg = tooltipData.text.map(MessageObject.fromObject.bind(MessageObject))
    } else {
      msg = MessageObject.fromObject(tooltipData.text)
    }
    controller.tooltips.show(
      Range.fromObject(tooltipData.range), msg, type, pluginName, { persistent },
    )
  }

  public hideTooltip(editor: TextEditor, type?: UPI.TEventRangeType, source?: string) {
    const controller = this.pluginManager.controller(editor)
    if (!controller) { return }
    controller.tooltips.hide(type, source)
  }

  private async defaultTooltipFunction(editor: TextEditor, type: UPI.TEventRangeType, crange: Range) {
    for (const { pluginName, handler, eventTypes } of this.providers) {
      if (!eventTypes.includes(type)) { continue }
      try {
        const tooltipData = await Promise.resolve(handler(editor, crange, type))
        if (!tooltipData) {
          continue
        }
        return { pluginName, tooltipData }
      } catch (e) {
        this.pluginManager.backendStatus(pluginName, { status: 'warning', detail: `${e}` })
        continue
      }
    }
  }
}
