import { Component } from 'react'

/**
 * Guards the canvas so a render error in one team's graph can't white-screen the
 * whole app (PRD R10 "no runtime crash on any of the 32 teams"). Reset it by
 * giving it a `key` that changes per team, so a new selection remounts cleanly.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Passing Signatures] render error:', error, info)
  }

  // Recover after an error when the team changes (resetKey), WITHOUT remounting
  // the child on every switch — that would break the team-switch morph.
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
          <div>
            <p className="font-display text-lg font-semibold text-text">
              Couldn’t render this view.
            </p>
            <p className="mt-1 font-body text-sm text-text-muted">
              Try picking another team or reloading the page.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
