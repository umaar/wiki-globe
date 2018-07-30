/** -*- compile-command: "jslint-cli app.js" -*-
 *
 * Copyright (C) 2011 Cedric Pinson
 *
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Authors:
 *  Cedric Pinson <cedric.pinson@plopbyte.net>
 *
 */

var countPerSecond = 0;
var FakeTweets;
var Socket;
var LastTweetReceived = new Date();
var ConnectionTimeoutCheck = 6;
var CheckNetworkTimeout;
var StreamConnected = 0;


function startNetwork() {
    try {
        jQuery('#connection').show();
        jQuery('#connection').removeClass('hidden');

        var checkNetwork = function() {
            if (CheckNetworkTimeout !== undefined) {
                window.clearTimeout(CheckNetworkTimeout);
                CheckNetworkTimeout = undefined;
            }
            var now = new Date();
            osg.log("checkNetwork " + now.getTime()/1000);
            if (FakeTweets === undefined) {
                var elapsed = (now.getTime()-LastTweetReceived.getTime())/1000.0;
                if (elapsed > ConnectionTimeoutCheck) {
                    //showConnection();
                    osg.log("no tags received for " + ConnectionTimeoutCheck +" seconds, restart connection");
                    console.log('Attempting a reconnection to WebSocket server');
                    startNetwork();
                    return;
                }
                //CheckNetworkTimeout = setTimeout(checkNetwork, ConnectionTimeoutCheck*1000);
            }
        };

        console.log('Socket on connection?');
        var socket = io();
        socket.on('connect', () => {
            console.log('Connected to the WebSocket Server');
            StreamConnected += 1;
            if (StreamConnected === 1) {
                // showInstructions();
            }
            hideConnection();
            LastTweetReceived = new Date();
            osg.log("connected to server!");
            //checkNetwork();
        });


        socket.on('message', (data) => {
            var broken = false;
            var data;
            if ( !document.webkitHidden ) {
                hideConnection();
                LastTweetReceived = new Date();
                processTweet(data);
            }
        });

        // osg.log("run the checker every " + ConnectionTimeoutCheck + " seconds");
        // setTimeout(checkNetwork, ConnectionTimeoutCheck*1000);
        // checkNetwork();

    } catch (er) {
        console.log('Error: ', er);
    }
}
