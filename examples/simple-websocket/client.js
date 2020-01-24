const ReconnectingSocket = require('../../index')
const Socket = require('simple-websocket')

const rsws = new ReconnectingSocket({
  backoff: {
    failAfter: null
  },
  create () {
    // Creating the new socket and return it
    // Be sure to notify for connection event, close event, and error event
    var socket = new Socket('ws://localhost:8456')

    socket.once('connect', this.open)
    socket.once('close', this.close)
    socket.once('error', this.error)

    return socket
  },

  destroy (socket) {
    // what gets called when a request to destroy the socket.
    // destroy the socket here
    socket.destroy()
  },

  onopen (socket, firstOpen) {
    // What gets called wheny you have a live socket
    console.log('onopen')
    this.pinger = setInterval(() => socket.write('ping'), 1000)
    socket.on('data', buf => console.log(buf.toString('utf8')))
  },

  onclose (socket) {
    // what to do when the socket is closed
    console.log('onclose')
    clearInterval(this.pinger)
  },

  onfail (err) {
    // handle the final error that caused the fail
    console.log('onfail')
    console.error(err)
  }
})

rsws.on('info', str => console.log(`info: ${str}`)) // indiciate state with these.
rsws.on('state', str => console.log(`state: ${str}`)) // Better just to read these than trigger other code path

rsws.start() // start it
