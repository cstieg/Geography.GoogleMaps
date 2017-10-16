using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;

namespace Cstieg.Geography.GoogleMaps
{
    /// <summary>
    /// Client for Google Maps API
    /// </summary>
    public class GoogleMapsClient
    {
        public static string apiKey = ConfigurationManager.AppSettings["GoogleMapsApiKey"];
        public static string baseUrl = "https://maps.googleapis.com/maps/api/";

        /// <summary>
        /// Gets a LatLng from an Address object
        /// </summary>
        /// <param name="address">A street address to geocode</param>
        /// <returns>The LatLng of the given street address</returns>
        public async Task<LatLng> GeocodeAddress(AddressBase address)
        {
            return await GeocodeAddress(address.ToString());
        }

        /// <summary>
        /// Gets a LatLng from a street address
        /// </summary>
        /// <param name="address">A street address to geocode</param>
        /// <returns>The LatLng of the given street address</returns>
        public async Task<LatLng> GeocodeAddress(string address)
        {
            using (var client = new HttpClient())
            {
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                client.DefaultRequestHeaders.AcceptLanguage.Add(new StringWithQualityHeaderValue("en_US"));

                // construct url for google maps api
                string url = baseUrl;
                url += "geocode/json";
                url += "?address=" + address;
                url += "&key=" + apiKey;
                url = url.Replace(" ", "+");

                // construct request
                HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, url);

                // send request and parse response
                var response = await client.SendAsync(request);
                var result = response.Content.ReadAsStringAsync().Result;
                GeocodingResponse geocodingResponse = JsonConvert.DeserializeObject<GeocodingResponse>(result);
                return geocodingResponse.Results.First<GeocodingResult>().Geometry.Location;
            }
        }

        /// <summary>
        /// Deserialize json response into an object (nested classes) conforming to google maps api result format
        /// </summary>
        /// <param name="result">The response from Google Maps Geocoding API</param>
        /// <returns>The geolocation data in object form</returns>
        public GeocodingResponse GetGeocodingResponseObject(string result)
        {
            return JsonConvert.DeserializeObject<GeocodingResponse>(result);
        }

        /// <summary>
        /// Gets the proper zoom setting for Google Maps with given radius
        /// </summary>
        /// <param name="radius">Desired radius of map in miles</param>
        /// <returns>Zoom setting for Google Maps</returns>
        public static int RadiusToZoom(double radius)
        {
            return (int) Math.Round(14 - Math.Log(radius) / Math.Log(2));
        }
    }

    // Classes mapping google maps api call result
    public class GeocodingResponse
    {
        [JsonProperty("results")]
        public List<GeocodingResult> Results { get; set; }
    }

    public class GeocodingResult
    {
        [JsonProperty("address_components")]
        public List<AddressComponent> AddressComponents { get; set; }

        [JsonProperty("formatted_address")]
        public string FormattedAddress { get; set; }

        [JsonProperty("geometry")]
        public Geometry Geometry { get; set; }

        [JsonProperty("partial_match")]
        public bool PartialMatch { get; set; }

        [JsonProperty("place_id")]
        public string PlaceId { get; set; }

        [JsonProperty("types")]
        public List<string> Types { get; set; }
    }

    public class AddressComponent
    {
        [JsonProperty("long_name")]
        public string LongName { get; set; }

        [JsonProperty("short_name")]
        public string ShortName { get; set; }

        [JsonProperty("types")]
        public List<string> Types { get; set; }
    }

    public class Geometry
    {
        [JsonProperty("location")]
        public LatLng Location { get; set; }

        [JsonProperty("location_type")]
        public string LocationType { get; set; }

        [JsonProperty("viewport")]
        public Viewport Viewport { get; set; }
    }

    public class Viewport
    {
        [JsonProperty("northeast")]
        public LatLng Northeast { get; set; }

        [JsonProperty("southwest")]
        public LatLng Southwest { get; set; }
    }

}