const { EventEmitter } = require('events')
const backoff = require('backoff')

/**
 * Class representing a reconnecting socket
 */
class ReconnectingSocket extends EventEmitter {
  /**
   * Create a reconnecting-socket
   * @param  {object} opts Options object (includes required fields for implementing the socket)
   * @return {object}      The reconnecting-socket instance
   */
  constructor (opts) {
    opts = Object.assign({
      name: 'rs-' + Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
      // oncreate: (ctx) => throw new Error('oncreate not implemented'),
      // ondestroy: (ctx) => throw new Error('ondestroy not implemented'),
      // onerror: (err, ctx) => throw new Error('onerror not implemented')
      // onclose: (err, ctx) => throw new Error('onclose not implemented')
    }, opts)

    opts.backoff = Object.assign({
      strategy: 'fibonacci',
      randomisationFactor: 0.2,
      initialDelay: 1000,
      maxDelay: 20000,
      failAfter: null
    }, opts.backoff)

    super(opts.name)

    this.socket = null

    if (opts.oncreate) this.oncreate = opts.oncreate
    if (opts.onopen) this.onopen = opts.onopen
    if (opts.ondestroy) this.ondestroy = opts.ondestroy
    if (opts.onclose) this.onclose = opts.onclose
    if (opts.onfail) this.onfail = opts.onfail

    // assert(typeof this.oncreate === 'function', 'oncreate must be implemented')
    // assert(typeof this.onconnect === 'function', 'onconnect must be implemented')
    // assert(typeof this.ondestroy === 'function', 'ondestroy must be implemented')
    // assert(typeof this.onfail === 'function', 'onfail must be implemented')
    // assert(typeof this.onclose === 'function', 'onclose must be implemented')

    // State
    this._state = 'stopped' // [ 'stopped', 'opening', 'opened', 'closing', 'closed', 'reopening', 'fail' ]
    this._firstOpen = null
    this._lastError = null

    // Backoff State Machine
    this.backoff = backoff[opts.backoff.strategy](opts.backoff)
    if (opts.backoff.failAfter) this.backoff.failAfter(opts.backoff.failAfter - 1)

    this.backoff.on('backoff', (number, delay) => {
      this._info(`backing off`)
      this.state = 'closed'
    })
    this.backoff.on('ready', (number, delay) => {
      this._info(`done waiting`)
      this._reopen()
    })
    this.backoff.on('fail', () => {
      this._info(`failed to connect after ${opts.backoff.failAfter} consecutive tries`)
      this._fail(
        this._lastError
      )
    })

    this.didOpen = this.didOpen.bind(this)
    this.didClose = this.didClose.bind(this)
    this.didError = this.didError.bind(this)
  }

  oncreate () {
    // overwrite me
  }

  onopen (socket, reopened) {
    // overwrite me
  }

  ondestroy (socket) {
    // overwrite me
  }

  onclose (socket) {
    // overwrite me
  }

  onfail (err) { // eslint-disable-line handle-callback-err
    // overwrite me
  }

  get state () {
    return this._state
  }

  set state (state) {
    this._state = state
    this.emit('state', state)
  }

  _error (err) {
    this._lastError = err
    this.emit('error', err)
  }

  _info (info) {
    this.emit('info', info)
  }

  _destroySocket () {
    if (!this.socket) {
      this._info(`socket already destroyed`)
      return
    }
    this._info(`destroying socket`)
    this.ondestroy(this.socket)
    this.socket = null
  }

  _createSocket () {
    if (this.socket) {
      this._info(`socket already created`)
      return
    }
    this._info(`creating new socket`)
    this.socket = this.oncreate(this, this._firstOpen)
  }

  _fail (err) {
    this._destroySocket()
    this.state = 'fail'
    this.onfail(err)
    this._error(err)
  }

  _reopen () {
    this._info(`socket reopening`)
    this.state = 'reopening'
    this._destroySocket()
    this._createSocket()
  }

  start () {
    this._info(`starting socket`)
    this.state = 'opening'
    this._firstOpen = true
    this._createSocket()
  }

  stop () {
    this._info(`stopping socket`)
    this._destroySocket()
    this.backoff.reset()
    this.state = 'stopped'
  }

  didOpen () {
    this.state = 'opened'
    this._info(`socket ${this._firstOpen ? 'opened' : 'reopened'}`)
    this.onopen(this.socket, this._firstOpen)
    if (this._firstOpen) this._firstOpen = false
    this.backoff.reset()
  }

  didClose () {
    this._info('socket closed')
    this.onclose(this.socket)
    this.backoff.backoff()
  }

  didError (err) {
    if (['opening', 'reopening'].some(state => this.state === state)) {
      const backoffNumber = this.backoff.backoffNumber_
      this._info(`Error durning open attempt ${backoffNumber}`)
    }
    this._error(err)
  }
}

module.exports = ReconnectingSocket
