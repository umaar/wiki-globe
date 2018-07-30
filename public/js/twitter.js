/** -*- compile-command: "jslint-cli twitter.js" -*-
 *
 * Copyright (C) 2010 Cedric Pinson
 *
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
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

var CacheLocation = {};

function getLatLongFromLocation(itemData, callback)
{
    if (callback === undefined) {
        callback = function (data0 ) {
            osg.log("location for " + data0.location);
            osg.log(data0);
        };
    }
    var str = itemData.user.location;
    //osg.log("place to find " + str);
    if (CacheLocation[str] === undefined) {
        var url = "http://ws.geonames.org/searchJSON?q=" + str +"&maxRows=10&callback=?";
        //osg.log("url " + url);
		console.log('getting json');
        jQuery.getJSON(url, function(data) {
            if (data.totalResultsCount !== undefined && data.totalResultsCount > 1) {
                var item = data.geonames[0];
                //osg.log(item);
                CacheLocation[str] = { 'lat': item.lat, 'lng': item.lng};
            } else {
                CacheLocation[str] = {'lat' : 0, 'lng': 0};
            }
            CacheLocation[str].location = str;
            callback(CacheLocation[str], itemData);
        });
    } else {
        callback(CacheLocation[str], itemData);
    }
}


var TweetProcessor;
var TweetFilter;
function installProcessTweet(callback)
{
    TweetProcessor = callback;
}

function randomFromTo(from, to){
       return Math.floor(Math.random() * (to - from + 1) + from);
}

iteration = 0;


var processTweet = function (tweet) {

if(tweet) {
    countPerSecond++;

	//console.log('Tag Stream found...processing: i: '+ ++iteration);

	var _tweet = {};

    if (tweet.data.type === 'edit') {
        const newRevision = tweet.data.revision.new;
        const oldRevision = tweet.data.revision.old;
        const serverUrl = tweet.data.server_url;
        _tweet.url = `${serverUrl}/w/index.php?diff=${newRevision}&oldid=${oldRevision}`
    } else {
        _tweet.url = tweet.data.meta.uri;
    }

    _tweet.parsedcomment = tweet.data.parsedcomment;
	//tweet = JSON.parse(tweet.SUBSCRIBE[2]);
	_tweet.geo = {
	  coordinates: [parseFloat(tweet.location.latitude), parseFloat(tweet.location.longitude)]
	};

    _tweet.text = tweet.data.comment;

	_tweet.place = {
		country: tweet.location.country_name
	};
	_tweet.user = {
		profile_image_url: "http://a2.twimg.com/profile_images/269322702/Logo_normal.jpg",
		name: "user name: "+ iteration,
		screen_name: `${tweet.data.type}: ${tweet.data.title}`
		//screen_name: "bloooop"+ iteration
	};
	// _tweet.id = randomFromTo(1,10000);
	_tweet.id = randomFromTo(20000,90000);
	_tweet.created_at = "Fri Dec "+randomFromTo(1,30)+" "+randomFromTo(1,12)+":"+randomFromTo(1,59)+":34 +0000 2010";/*(new Date(tweet.time)).toGMTString();*/
	tweet = _tweet;

}
	
    try {
        if (TweetFilter === undefined) {
            TweetFilter = [];
            for (var d = 0; d < 20; d++) {
                TweetFilter.push(0);
            }
        }

        var currentTweetId = tweet.id;
        for (var i = 0, l = TweetFilter.length ; i < l; i++) {
            var id = TweetFilter[i];
            if (id === currentTweetId) {
                osg.log("found a duplicate of id " + currentTweetId + " discard it");
                return;
            }
        }
        TweetFilter.shift();
        TweetFilter.push(currentTweetId);
        var cb = TweetProcessor;
        if (cb === undefined) {
            cb = function(data) { osg.log(data); };
        }
        cb(tweet);
    } catch (er) {
		console.log('catch block, there was an error');
        osg.log(er);
    }
};



var TwitterPictureRendering;
var FrameTwitter;
var MaskTwitter;
function displayTweetPictureToCanvas ( image, texture) {
    var twitterRendering;
    if (TwitterPictureRendering === undefined) {
        twitterRendering = document.getElementById("TweetPicture");
        TwitterPictureRendering = twitterRendering;
        FrameTwitter = new Image();
        FrameTwitter.src = "img/frame.png";
        MaskTwitter = new Image();
        MaskTwitter.src = "img/alpha.png";
    } else {
        twitterRendering = TwitterPictureRendering;
    }
    var textureSizeX = twitterRendering.width;
    var textureSizeY = twitterRendering.height;

    var ctx = twitterRendering.getContext("2d");
    
    var ratio = textureSizeX / image.width;
    ratio /= 2;

    ctx.save();
    ctx.clearRect (0, 0, textureSizeX, textureSizeY);

    ctx.scale(ratio, ratio);
    ctx.drawImage(MaskTwitter, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
	//image.src = "http://a1.twimg.com/profile_images/1160937588/68812_1206834828518_1758117509_374121_3157665_n_1__normal.jpg";
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(FrameTwitter, 0, 0);
    ctx.restore();
    var t;
    if (texture !== undefined) {
        t = texture;
    } else {
        t = new osg.Texture();
        t.setMinFilter('LINEAR');
    }
	//this shouldn't really be commented out.
    t.setFromCanvas(twitterRendering);
    return t;
}
