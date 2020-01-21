const Server = require('simple-websocket/server')

const server = new Server({ port: 8456 }) // see `ws` docs for other options

server.on('connection', function (socket) {
  console.log('connected')
  socket.write('pong')
  socket.on('data', function (buf) {
    socket.write(buf.toString('utf8').toUpperCase())
  })
  socket.on('close', () => console.log('closed'))
  socket.on('error', console.error)
})

// server.close()
