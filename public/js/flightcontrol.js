var FlightControl = FlightControl || {};

(function($, FlightControl) {
    $(function() {
        FlightControl.Controller.init()
    })

    function Controller() {
        this.socket = io()
    }

    Controller.prototype = {
        init: function() {
            this.bindEvents()
        },
        connect: function() {
            console.log('Connecting...')
            this.socket.emit('connect-drone')
        },
        takeoff: function() {
            console.log('Takeoff...')
            this.socket.emit('takeoff')
        },
        calibrate: function() {
            console.log('Calibrating...')
            this.socket.emit('calibrate')
        },
        land: function() {
            console.log('Landing...')
            this.socket.emit('land')
        },
        disconnect: function() {
            console.log('Disconnecting...')
            this.socket.emit('disconnect-drone')
        },
        handleNavigation: function(translation) {
            if (translation[1] < 0 && Math.abs(translation[1]) > Math.abs(translation[0])) {
                this.socket.emit('move-forward', translation[1])
            } else if (translation[1] > 0 && Math.abs(translation[1]) > Math.abs(translation[0])) {
                this.socket.emit('move-backward', translation[1])
            } else if (translation[0] < 0) {
                this.socket.emit('move-left', translation[0])
            } else if (translation[0] > 0) {
                this.socket.emit('move-right', translation[0])
            }
        },
        stopNavigation: function() {
            console.log('Hover Time')
            this.socket.emit('stop-navigation')
        },
        yawDance: function() {
            console.log('Performing Yaw Dance')
            this.socket.emit('yawDance')
        },
        wave: function() {
            console.log('Performing Wave')
            this.socket.emit('wave')
        },
        flipRight: function() {
            console.log('Performing Right Flip')
            this.socket.emit('flipRight')
        },
        flipBehind: function() {
            console.log('Performing Back Flip')
            this.socket.emit('flipBehind')
        },
        bindEvents: function() {
            $('#connect').on('click', this.connect.bind(this))
            $('#takeoff').on('click', this.takeoff.bind(this))
            $('#calibrate').on('click', this.calibrate.bind(this))
            $('#land').on('click', this.land.bind(this))
            $('#disconnect').on('click', this.disconnect.bind(this))

            $('#yaw-dance').on('click', this.yawDance.bind(this))
            $('#wave').on('click', this.wave.bind(this))
            $('#flip-right').on('click', this.flipRight.bind(this))
            $('#flip-behind').on('click', this.flipBehind.bind(this))

            new Sistine(document.getElementById('drone'), {
                recognizers: [
                    new Sistine.Pan({eventName:'pan'})
                ]
            }).on('pan', function(ev) {
                if (ev.state === Sistine.STATE_STARTED) {
                    console.log("Pan Started")
                }
                else if (ev.state === Sistine.STATE_CHANGED) {
                    console.log("Pan Changed Translation " + ev.translation)
                    ev.currentTarget.style.transform = "translate(" + ev.translation[0] + "px," + ev.translation[1] + "px)"
                    FlightControl.Controller.handleNavigation(ev.translation)
                }
                else if (ev.state === Sistine.STATE_ENDED) {
                    console.log("Pan Ended")
                    ev.currentTarget.style.transform = "translate(0px,0px)"
                    FlightControl.Controller.stopNavigation()
                }
            });
        }
    }

    FlightControl.Controller = new Controller()
}(jQuery, FlightControl))
