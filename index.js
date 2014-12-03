var express = require('express'),
    app     = express(),
    http    = require('http').Server(app),
    io      = require('socket.io')(http),
    drone   = require('ar-drone')

app.use("/public", express.static(__dirname + '/public'))

app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/index.html')
})

io.on('connection', function(socket){
    socket.on('connect-drone', function(msg) {
        console.log('Connecting to drone...')
        drone.client = drone.createClient()
    })
    
    socket.on('takeoff', function() {
        console.log('Lift off!')
        if (drone.client) {
            drone.client.takeoff()
        }
    })

    socket.on('calibrate', function() {
        console.log('Calibrating!')
        if (drone.client) {
            drone.client.calibrate(0)
        }
    })

    socket.on('land', function() {
        console.log('Landing!')
        if (drone.client) {
            drone.client.land()
        }
    })

    socket.on('disconnect-drone', function() {
        console.log('Disconnecting from drone...')
        if (drone.client) {
            drone.client.disableEmergency()
        }
    })

    socket.on('move-forward', function(mag) {
        console.log("Offset Forward: " + mag)
        if (drone.client) {
            drone.client.stop()
            drone.client.front(.3)
        }
    })

    socket.on('move-backward', function(mag) {
        console.log("Offset Backward: " + mag)
        if (drone.client) {
            drone.client.stop()
            drone.client.back(.3)
        }
    })

    socket.on('move-left', function(mag) {
        console.log("Offset Left: " + mag)
        if (drone.client) {
            drone.client.stop()
            drone.client.left(.3)
        }
    })

    socket.on('move-right', function(mag) {
        console.log("Offset Right: " + mag)
        if (drone.client) {
            drone.client.stop()
            drone.client.right(.3)
        }
    })

    socket.on('stop-navigation', function() {
        console.log('Stopping Navigation')
        if (drone.client) {
            drone.client.stop()
        }
    })

    socket.on('yawDance', function() {
        console.log('Performing Yaw Dance')
        if (drone.client) {
            drone.client.animate('yawDance', 3000)
        }
    })

    socket.on('wave', function() {
        console.log('Performing the Wave')
        if (drone.client) {
            drone.client.animate('wave', 2000)
        }
    })

    socket.on('flipRight', function() {
        console.log('Performing Right Flip')
        if (drone.client) {
            drone.client.animate('flipRight', 250)
        }
    })

    socket.on('flipBehind', function() {
        console.log('Performing Back Flip')
        if (drone.client) {
            drone.client.animate('flipBehind', 250)
        }
    })

    socket.on('disconnect', function() {
        console.log('Socket disconnected')
    })
})

http.listen(3000, function() {
    console.log('listening on port 3000')
})
