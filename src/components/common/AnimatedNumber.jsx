import { Component as ReactComponent } from 'react'

export default class AnimatedNumber extends ReactComponent {
  static getDerivedStateFromProps(nextProps, prevState) {
    if (!prevState.hasValue) {
      return {
        hasValue: true,
        current: nextProps.value,
        previous: undefined,
        settling: true,
      }
    }

    if (Object.is(prevState.current, nextProps.value)) return null

    return {
      current: nextProps.value,
      previous: prevState.current,
      settling: true,
    }
  }

  state = {
    hasValue: false,
    current: this.props.value,
    previous: undefined,
    settling: true,
  }

  componentDidMount() {
    this.queueSettle()
  }

  componentDidUpdate(prevProps) {
    if (!Object.is(prevProps.value, this.props.value)) {
      this.queueSettle()
    }
  }

  componentWillUnmount() {
    window.clearTimeout(this.settleTimer)
  }

  queueSettle() {
    const duration = this.props.duration ?? 280
    window.clearTimeout(this.settleTimer)
    this.settleTimer = window.setTimeout(() => {
      this.setState({ previous: undefined, settling: false })
    }, duration)
  }

  render() {
    const {
      as: RenderComponent = 'span',
      className = '',
      style = {},
      duration = 280,
      value: _value,
      ...props
    } = this.props
    const isRolling = this.state.previous !== undefined

    return (
      <RenderComponent
        {...props}
        className={['animated-number', className].filter(Boolean).join(' ')}
        data-settling={this.state.settling ? 'true' : 'false'}
        data-prev-value={String(this.state.previous ?? '')}
        style={{
          display: 'inline-block',
          animation: `metric-settle ${duration}ms ease-out both`,
          ...style,
        }}
      >
        {isRolling && (
          <span
            data-testid={props['data-testid'] ? `${props['data-testid']}-previous` : undefined}
            aria-hidden="true"
            style={{
              display: 'inline-block',
              opacity: 0.6,
              transform: 'translateY(4px)',
              transition: `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
            }}
          >
            {this.state.previous}
          </span>
        )}
        <span
          data-testid={props['data-testid'] ? `${props['data-testid']}-current` : undefined}
          style={{
            display: 'inline-block',
            marginLeft: isRolling ? 4 : 0,
            opacity: 1,
            transform: 'translateY(0)',
            transition: `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
          }}
        >
          {this.state.current}
        </span>
      </RenderComponent>
    )
  }
}
