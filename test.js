const tap = require('tap')
const ReconnectingSocket = require('./index')
const net = require('net')

tap.test('yolo hook it all up test', t => {
  t.plan(9)
  const connections = []
  const server = net.createServer((socket) => {
    console.log('client connected')
    connections.push(socket)
    socket.on('data', function (buf) {
      t.pass(`server received a message: ${buf.toString('utf8')}`)
      socket.write(buf.toString('utf8').toUpperCase())
    })
    socket.on('close', () => {
      t.pass('server closed')
      connections.splice(connections.find(s => s === socket), 1)
    })
    socket.on('error', err => t.error(err, 'socket should not error'))
  })

  server.on('error', (err) => {
    t.fail(err, 'server should not emit errors')
  })

  function closeAllConnections () {
    connections.forEach(socket => socket.destroy())
  }

  const firstConnectPath = (buf) => {
    t.equal(buf.toString('utf8'), 'PING1', 'uppercase ping1')
    server.close()
    closeAllConnections()
    setTimeout(() => {
      console.log('server starting again')
      server.listen(8124)
    }, 3000)
  }

  const secondConnectPath = (buf) => {
    t.equal(buf.toString('utf8'), 'PING2', 'uppercase ping2')
    server.close()
    reconnectingTCP.stop()
    setTimeout(() => {
      reconnectingTCP.start()
    }, 500)
  }

  const reconnectingTCP = new ReconnectingSocket({
    backoff: {
      failAfter: 4
    },
    create () {
      const socket = new net.Socket()
      socket.on('close', this.close)
      socket.on('error', this.error)
      socket.on('connect', this.open)
      socket.connect(8124)

      return socket
    },
    destroy (socket) {
      socket.destroy()
    },
    onopen (socket, firstOpen) {
      if (firstOpen) {
        t.pass('fisrtOpen socket ran')
        socket.on('data', firstConnectPath)
        socket.write('ping1')
      } else {
        t.pass('!fisrtOpen socket ran')
        socket.on('data', secondConnectPath)
        socket.write('ping2')
      }
    },
    onclose (socket) {
      socket.removeListener('data', firstConnectPath)
      socket.removeListener('data', secondConnectPath)
    },
    onfail (err) {
      t.equals(err.message, 'connect ECONNREFUSED 127.0.0.1:8124', 'can\'t connect message looks good')
    }
  })

  reconnectingTCP.on('info', console.log)

  server.listen(8124, () => {
    console.log('server started')
    reconnectingTCP.start()
  })
})
