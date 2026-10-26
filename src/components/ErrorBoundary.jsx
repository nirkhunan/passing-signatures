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
        <div className="error-view">
          <p className="error-title">Couldn’t render this view.</p>
          <p>Try another team or reload the page.</p>
        </div>
      )
    }
    return this.props.children
  }
}
