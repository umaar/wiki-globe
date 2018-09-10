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

function sleep(ms = 1000) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

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

        var socket = io({ path: '/globe/socket.io'});
        socket.on('connect', (io) => {
            const urlParams = new URLSearchParams(location.search);
            const selectedTime = urlParams.get('time');
            const searchQuery = urlParams.get('query');
            let offset = 0;

            console.log('Connected to the WebSocket Server ✅️');
            StreamConnected += 1;
            if (StreamConnected === 1) {
                // showInstructions();
            }
            hideConnection();
            LastTweetReceived = new Date();

            function requestTimeRangeEdits(selectedTime, offset = 0) {
                console.log(`ℹ️ ${selectedTime} selected. Offset: ${offset}`);
                socket.emit('message', {
                    selectedTime,
                    offset
                });
            }

            function requestSearchQueryEdits(searchQuery, offset = 0) {
                console.log(`ℹ️ '${searchQuery}' search query. Offset: ${offset}`);

                socket.emit('search-query', {
                    searchQuery,
                    offset
                });
            }

            //checkNetwork();

            function registerRealTimeHandler() {
                offset = 0;
                socket.on('message', (data) => {
                    if ( !document.webkitHidden ) {
                        // hideConnection();
                        // TODO: Can we remove this line below? Might be leaking memory
                        // LastTweetReceived = new Date();
                        processTweet(data);
                    }
                });
            }

            socket.on('results', async function(res) {
                const resLength = res.length;
                if (res && resLength) {
                    console.log(`Got ${resLength} wiki edits to get through`);

                    for (let item of res) {
                        await sleep(16);
                        requestAnimationFrame(() => {
                            // TODO: Tidy this:
                            processTweet(item);
                        });
                    }

                    offset += resLength;

                    requestMoreWikiEdits();
                } else {
                    console.log('Received undefined/empty results', res);
                    registerRealTimeHandler();
                }
            });

            function requestMoreWikiEdits() {
                if (selectedTime) {
                    requestTimeRangeEdits(selectedTime, offset);
                } else if (searchQuery) {
                    requestSearchQueryEdits(searchQuery, offset);
                } else {
                    console.log('⚠️ no default time selected or search query selected');
                    registerRealTimeHandler();
                }
            }

            requestMoreWikiEdits();
        });




    } catch (er) {
        console.log('Error: ', er);
    }
}
