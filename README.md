# reconnecting-socket
[![Actions Status](https://github.com/little-core-labs/reconnecting-socket/workflows/tests/badge.svg)](https://github.com/little-core-labs/reconnecting-socket/actions)

Generic state machine for sockets.  Provides granular state handling, and start/stop functionality.  Decouples socket creation and destruction in tandem with reconnect, start and stop logic, from what the socket is acually doing.

```
npm install reconnecting-socket
```

## Usage

``` js
const ReconnectingSocket = require('reconnecting-socket')
const net = require('net')

const reconnectingTCP = new ReconnectingSocket({
  backoff: {
    failAfter: 4
  },
  create () {
    const socket = new net.Socket()
    // You are also free to redirect this info.
    // Indicate the socket is exausted/failed/done.
    socket.once('close', this.close)
    // Capture errors.  The last one will be availabl in onfail
    socket.once('error', this.error)
    // Notify the socket is open/connected/ready for use
    socket.once('connect', this.open)
    socket.connect(8124)

    return socket
  },
  destroy (socket) {
    // Clean up and stop a socket when reconnectingTCP.stop() is called
    socket.destroy()
  },
  onopen (socket, firstOpen) {
    // Do stuff with the socket here
    // pump(socket, something, socket)
  },
  onclose (socket) {
    // Remove event listeners, stop intervals etc.
  },
  onfail (err) {
    console.error(err)
    // Handle the final error that was emitted that caused retry to stop.
  }
})

// Hook reactive UIs to these events
reconnectingTCP.on('info', console.log) // debugging info
reconnectingTCP.on('state', console.log) // state inof
```

You can also extend ReconnectingSocket if you would prefer a class.

```js
const ReconnectingSocket = require('reconnecting-socket')
const net = require('net')

class ReconnectingTCP extends ReconnectingSocket {
  constructor (opts) {
    super(opts)

    this.someHandler = this.someHandler.bind(this)
  }

  create () {
    const socket = new net.Socket()
    socket.on('close', this.close)
    socket.on('error', this.error)
    socket.on('connect', this.open)
    socket.connect(8124)

    return socket
  }

  destroy (socket) {
    socket.destroy()
  }

  someHandler (buf) {
    // whatever
  }

  onopen (socket, firstOpen) {
    socket.on('data', this.someHandler)
  }

  onclose (socket) {
    socket.removeListener('data', this.somehandler)
  }

  onfail (err) {
    console.error(err)
    // Handle the final error that was emitted that caused retry to stop.
  }
}

module.exports = ReconnectingTCP
```

## API

### `const ReconnectingSocket = require('reconnecting-socket')`

Require the `ReconnectingSocket` class.

### `reconnectingSocket = new ReconnectingSocket(opts)`

Create a new reconnecting socket instance.  The `opts` object can receive the user implemented methods listed below as well as the following optional options:

```js
{
  backoff: {
    strategy: 'fibonacci', // the backoff strategey to use
    failAfter: null, // the number of consecutive times to attemt a reconnect before failing
    ...backoffOptions // all the options from the backoff module
  }
}
```

See full set of backoff options here: [MathieuTurcotte/node-backoff](https://github.com/MathieuTurcotte/node-backoff#readme)

#### `reconnectingSocket` Events

- `state`: The state emmits the following `state` strings:
  - `stopped`
  - `opening`
  - `opened`
  - `closing`
  - `closed`
  - `reopening`
  - `failed`
- `info`: Messages that can be used for debugging.

### `reconnectingSocket.start()`

Start the reconnecting socket.

### `reconnectingSocket.stop()`

Stop the reconnecting socket.

## User Implemented Methods

### `socket = reconnectingSocket.create()`

Implement the `.create` method that is run when a new socket should be created.  The method should return a `socket`, and attatch listeners or callbacks to trigger the following methods:

- `this.open()`: Called when the socket is connected or ready.
- `this.error(err)`: Called when the socket encounters an error.  Used to capture the last error emited to be returned onfail.
- `this.close()`: Called when the socket is fully closed or exausted.  This triggers the reconnect.

The returned socket will be passed to various other hooks and events.

### `reconnectingSocket.destroy(socket)`

The body of this method should destroy the socket (e.g. `socket.destroy()`).  This is called when `reconnectingSocket.stop()` is called.

### `reconnectingSocket.onopen(socket, firstOpen)`

This method is called whenever a new socket is created and the `this.open()` method has been called, so the socket should be live and ready for data.  It receives the `socket` as well as `firstOpen` boolean which indicates if this is the first successful connection since calling `reconnectingSocket.start()`.  Interact with the socket in this function body.

### `reconnectingSocket.onclose(socket)`

This method is called when the `this.close()` method is called.  Use this to clean up any event listeners or intervals used on the socket.

### `reconnectingSocket.onfail(err)`

This method is called when the reconnectignSocket fails to connect after `failAfter` concecutive attempts.  It receives the last error emitted by the various moving parts.

## See also

- [reconnecting-simple-websocket](https://github.com/little-core-labs/reconnecting-simple-websocket)

## License

MIT
