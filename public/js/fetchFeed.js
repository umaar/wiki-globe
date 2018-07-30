$(function() {


	var extractTrackInfo = function(data) {

		return  {
			id: data.trackId || data.id,
			title: data.title || data.trackTitle,
			artist: data.description || data.artists[0].artistName 
		};
	}; //extractTrackInfo


	var displayTrackItems = function(feed, msg) {
		var socialContainer = $("<ul class='socialContainer'></ul>");
		var message = $("<h2>").text(msg)
		feed.forEach(function(item) {
			var anchor = $("<a>");
			var li = $("<li>")

			var track = extractTrackInfo( item.data || item );
			//track.artist = data.description;
			//track.title = data.title;
			//track.id = data.id;

			anchor.attr("href", track.url);
			anchor.append("<img src='http://images.shazam.com/webtid/"+ track.id +"/size/100' />");
			anchor.append("<h3>"+ track.title +"</h3>");
			anchor.append("<h4>"+ track.artist +"</h4>");
			li.append(anchor)
			socialContainer.append( li );
		});

		$("#socialContainer").html(socialContainer).prepend( message );
	}; //displayTrackItems



	var fetchFeed = function (_id, geo) {
		var id = _id || "7F797EE0-F877-62BA-836F-DED959468E31"; 
		$.ajax({
			url: "http://umar.local:7777/feed/" + id,
			success: function(data) {
				if (data && data.feed) {
					displayTrackItems(data.feed, "Friends of this tagger have also tagged: ");
				} else {
					fetchChart(geo || null);
				}
			}
		});
	}; //fetchFeed



	var fetchChart = function(geo) {
		var lat = geo[0] || "50.8332608";
		var lon = geo[1] || "6.911561";

		var url = 'http://'+location.hostname + ':7777' + "/chart/" + lat + "/" + lon;

		console.log('Fetching chart @ ', url);

		$.ajax({
			url: url,
			success: function(data) {
				if (data) {
					displayTrackItems(data.chart, "Chart - Top tracks in this area: ");
				}
			}
		});
	}; //fetchChart


	window.fetchFeed = fetchFeed;
	window.fetchChart = fetchChart;

});
