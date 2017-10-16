/*  References:
    * JQuery

    Calls:
    * Google Maps API
*/

// Load Google Maps API if on page calling for it
(function callGMaps() {
    var $gmapsUrl = $('#google-maps-url-info').text();
    if ($gmapsUrl) {
        $.getScript($gmapsUrl).fail(function (jqxhr, settings, exception) {
            alert("Wasn't able to load map :(");
            window.location = "/order";
        });
    }
})();

// callback from Google Maps when finished loading API
function initialMap() {
    // If zip has been specified, set location passed from server
    var position = "";
    var positionText = ($('#location').text()).trim();
    if (positionText) {
        position = JSON.parse(positionText);
    }
    if (position) {
        retailerMap.init(position);
        return;
    }

    // If no zip has been specified, get location from browser or ip
    if (navigator.geolocation) {
        // location from browser
        var options = { timeout: 10000 };
        navigator.geolocation.getCurrentPosition(function (data) {
            var position = new LatLng(data.coords.latitude, data.coords.longitude);
            retailerMap.init(position);
        },
            function (err) {
                // location from ip
                $.getJSON('http://freegeoip.net/json/', function (data) {
                    var position = new LatLng(data.latitude, data.longitude);
                    retailerMap.init(data);
                });
            },
            options);
    }
    else {
        // location from ip
        $.getJSON('http://freegeoip.net/json/', function (data) {
            retailerMap.init(data);
        });
    }
}

/* ************************ Code for retailer map page ************************************** */
var retailerMap = {
    init: function (userLocation) {
        // reference to retailerMap for use in callbacks
        var self = this;
        
        // div in which to render map
        var mapElement = $('#retailer-map-view')[0];

        this.location = userLocation;
        this.zoom = parseInt($('#zoom').text());

        // create instance of map wrapper class
        this.map = new GMap(mapElement, this.location, this.zoom);

        // add event handlers to update retailers on map load or move
        this.map.onLoad(function () {
            self.updateRetailers(self.map.getBounds());
        }).onPan(function () {
            self.updateRetailers(self.map.getBounds());
        }).onZoom(function () {
            self.updateRetailers(self.map.getBounds());
        });

        // container for retailer objects
        this.retailers = [];
    },

    // Get data for retailers within mapBounds from server, call method to show them when finished
    updateRetailers: function (mapBounds) {
        var self = this;
        var maxLat = mapBounds.f.f;
        var leftLng = mapBounds.b.b;
        var minLat = mapBounds.f.b;
        var rightLng = mapBounds.b.f;

        $.getJSON('/retailermap/updateretailerjson' +
            '?maxlat=' + maxLat + 
            '&leftlng=' + leftLng +
            '&minlat=' + minLat +
            '&rightlng=' + rightLng +
            '&currentlat=' + this.location.lat +
            '&currentlng=' + this.location.lng, function (result) {
                self.retailers = result;
                self.showRetailers();
        });
    },

    // Show retailers in list and on map
    showRetailers: function () {
        // reference to retailerMap for use in callbacks
        var self = this;

        // container for retailer list
        $retailerList = $('#retailer-list');

        // empty retailer list before populating it
        $retailerList.html('');

        // display message if no retailers in range
        if (this.retailers.length === 0) {
            $('#retailer-list').html('<p>Sorry, no retailers in this area. You may <a href="/order">order here.</a></p>');
        }

        for (var i = 0; i < this.retailers.length; i++) {
            var retailer = this.retailers[i];

            // hack to make variable name case match data from server
            retailer.LatLng.lat = retailer.LatLng.Lat;
            retailer.LatLng.lng = retailer.LatLng.Lng;

            // calculate distance to user's location
            retailer.distance = distance(retailer.LatLng, this.location);

            // get retailer list element from template function
            var retailerListElement = this.getRetailerListItem(retailer);

            // add map marker to map
            var gMarker = this.map.addMarker(retailer.LatLng, retailerListElement.html());

            // add listener to show info window with marker on map when mouse over retailer in list
            retailerListElement.bind('mouseenter', { gM: gMarker }, function(event) {
                self.map.showInfoWindow(event.data.gM);
            });

            // add retailer list elements to list
            $retailerList.append(retailerListElement);
        }
        this.sortRetailersByDistance();
    },

    // template to generate retailer list item
    getRetailerListItem: function (retailer) {
        $retailerItemTemplate = $('#retailer-item-li-template .retailer-item-li');

        // clear out data from any previous iteration
        $('#retailer-item-li-template .retailer-item').children().text('');

        $retailerItemTemplate.find('.retailer-name').text(retailer.Name);
        $retailerItemTemplate.find('.retailer-distance').text(retailer.distance.toPrecision(3) + ' miles from your location');
        $retailerItemTemplate.find('.retailer-address').html(retailer.Address.Address1 + '<br />' +
            retailer.Address.City + ', ' + retailer.Address.State + ' ' + retailer.Address.Zip + '<br />');
        if (retailer.Address.Phone) {
            $retailerItemTemplate.find('.retailer-phone')
                .html(retailer.Address.Phone + '<br />')
                .prop('href', 'callto:' + retailer.Address.Phone);
        }
        if (retailer.Website) {
            $retailerItemTemplate.find('.retailer-website')
                .text(retailer.Website)
                .prop('href', retailer.Website);
        }
        return $retailerItemTemplate.clone();
    },

    // sort retailers in list view by distance to user
    sortRetailersByDistance() {
        var $retailers = $('.retailer-item');
        var $retailerList = $retailers.find('.retailer-item-li');

        $retailerList.detach().sort(function (a, b) {
            var aDistance = parseInt($(a).find('.retailer-distance').text());
            var bDistance = parseInt($(b).find('.retailer-distance').text());
            return (aDistance > bDistance) ? (aDistance < bDistance) ? 1 : 0 : -1;
        });
        $retailers.append($retailerList);
    }

};



/* ************************************** GMap ********************************************************** */
// Wrapper class for Google Map
class GMap {
    constructor(mapElement, location = null, zoom = 5) {
        this._mapElement = mapElement;
        this._location = location;
        if (location === null) {
            this._location = new LatLng(43, -86);
        }
        this._zoom = zoom;

        this._map = new google.maps.Map(this._mapElement, {
            zoom: this._zoom,
            center: this._location
        });
        this._infoWindow = new google.maps.InfoWindow();

        this._markers = [];
        this._mouseIsDown = false;
        this._isPanning = false;
        if (location === null) {
            this.setMapToCurrentLocation();
        }
    }

    // add a marker at a specified location to the map, and show info window on mouseover
    addMarker(location, content) {
        var newMarker = new google.maps.Marker({
            position: new google.maps.LatLng(location),
            address: '',
            placeName: '',
            content: content,
            parentClass: this
        });

        google.maps.event.addListener(newMarker, 'mouseover', function (event) {
            // parentClass is included in the marker object as a hack to get a reference back to the class
            newMarker.parentClass.showInfoWindow(newMarker);
        });

        // place the marker on the map
        newMarker.setMap(this._map);
        this._markers.push(newMarker);

        return newMarker;
    }

    deleteAllMarkers() {
        for (var i = 0; i < this._markers.length; i++) {
            var marker = this._markers[i];
            marker.setMap(null);
        }
        this._markers = [];
    }

    // opens an infoWindow displaying the information for the given marker
    showInfoWindow(marker) {
        marker.setAnimation(google.maps.Animation.BOUNCE);
        marker.setAnimation(null);
        this._infoWindow.setContent(marker.content);
        this._infoWindow.open(this._map, marker);
    }

    getBounds() {
        return this._map.getBounds();
    }

    setMapToCurrentLocation(map = this._map) {
        $.getJSON('http://freegeoip.net/json/', function (data) {
            map.setCenter(new google.maps.LatLng(data.latitude, data.longitude));
        });
    }

    // ***** Event Handlers ******
    onLoad(callback) {
        google.maps.event.addListenerOnce(this._map, 'idle', callback);
        return this;
    }

    onPan(callback) {
        var self = this;
        this._map.addListener('mousedown', function () {
            self._mouseIsDown = true;
        });
        this._map.addListener('mouseup', function () {
            self._mouseIsDown = false;
            if (self._isPanning) {
                callback();
            }
            self._isPanning = false;
        });
        this._map.addListener('center_changed', function () {
            self._isPanning = true;
            if (!self._mouseIsDown) {
                callback();
            }
        });
        return this;
    }

    onZoom(callback) {
        this._map.addListener('zoom_changed', callback);
        return this;
    }
}

// Helper class representing a geographical point
class LatLng {
    constructor(lat, lng) {
        this.lat = lat;
        this.lng = lng;
    }
}

/**
 * Finds the distance between two geographical points in miles
 * Based on Haversine Formula
 * Based on code by Salvador Dali, https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
 * @param {LatLng} point1
 * @param {LatLng} point2
 */
function distance(point1, point2) {
    // pi / 180
    var p = 0.017453292519943295;

    var c = Math.cos;
    var a = 0.5 - c((point2.lat - point1.lat) * p) / 2 +
        c(point1.lat * p) * c(point2.lat * p) *
        (1 - c((point2.lng - point1.lng) * p)) / 2;
    // 2 * R; R = 6371 km
    var km = 12742 * Math.asin(Math.sqrt(a));
    var miles = km * 0.621371;
    return miles;
}
