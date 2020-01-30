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
      // create: (ctx) => throw new Error('create not implemented'),
      // destroy: (ctx) => throw new Error('destroy not implemented'),
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

    if (opts.create) this.create = opts.create
    if (opts.destroy) this.destroy = opts.destroy
    if (opts.onopen) this.onopen = opts.onopen
    if (opts.onclose) this.onclose = opts.onclose
    if (opts.onfail) this.onfail = opts.onfail

    // assert(typeof this.create === 'function', 'create must be implemented')
    // assert(typeof this.onconnect === 'function', 'onconnect must be implemented')
    // assert(typeof this.destroy === 'function', 'destroy must be implemented')
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

    this.open = this.open.bind(this)
    this.close = this.close.bind(this)
    this.error = this.error.bind(this)
  }

  create () {
    throw new Error('implement me!')
  }

  destroy (socket) {
    throw new Error('implement me!')
  }

  onopen (socket, firstOpen) {
    // optional
  }

  onclose (socket) {
    this._info('onclose method not implemented')
  }

  onfail (err) {
    this._info(`failed: ${err.message}`)
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
    this.destroy(this.socket)
  }

  _createSocket () {
    if (this.socket) {
      this._info(`socket already created`)
      return
    }
    this._info(`creating new socket`)
    this.socket = this.create(this, this._firstOpen)
  }

  _fail (err) {
    this.state = 'fail'
    this.onfail(err)
  }

  _reopen () {
    this._info(`socket reopening`)
    this.state = 'reopening'
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

  open () {
    this.onopen(this.socket, this._firstOpen)
    this.state = 'opened'
    this._info(`socket ${this._firstOpen ? 'opened' : 'reopened'}`)
    if (this._firstOpen) this._firstOpen = false
    this.backoff.reset()
  }

  close () {
    this.onclose(this.socket)
    this._info('socket closed')
    this.socket = null
    if (this.state !== 'stopped') this.backoff.backoff()
  }

  error (err) {
    if (['opening', 'reopening'].some(state => this.state === state)) {
      const backoffNumber = this.backoff.backoffNumber_
      this._info(`Error durning open attempt ${backoffNumber}`)
    }
    this._error(err)
  }
}

module.exports = ReconnectingSocket
