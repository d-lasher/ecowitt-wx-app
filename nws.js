
var jsonLocation
var jsonDailyForecast
var jsonHourlyForecast
var jsonGridData
var jsonSunriseSunset

function KmToM(km) {
    let m = parseInt( km / 1.609 )
    return m
}

function CtoF(c) {
   let f = parseInt( ((c * 9.0) / 5.0) + 32.0 )
   return f
}

function MMtoIN(cm) {
    let inch = (cm / 25.4)
    return inch
 }

function AngletoSLug(angle) {
    let slug = [ 'N','NE','E','SE','S','SW','W','NW','N','N']
    let idx = Math.round( (angle / 45.0) + 0.5  )
    idx =  Math.max(0, idx)
    idx = Math.min(idx,8)
    return slug[idx]
}

async function fetchNwsForecast(id) {
    jsonLocation = await getNwsLocationJSON(id);
    location_properties = jsonLocation['properties']
    jsonDailyForecast = await getNwsWsJSON( location_properties['forecast'] )
    jsonHourlyForecast = await getNwsWsJSON( location_properties['forecastHourly'] )
    jsonGridData = await getNwsWsJSON( location_properties['forecastGridData'] )
    jsonSunriseSunset = await getSunriseSunset()

    console.log(jsonDailyForecast)
    console.log(jsonGridData)
    return null
}

function nwsTimeToUTS(nwsTimeString) {
    let loc = nwsTimeString.lastIndexOf('/')
    let uts = Date.parse(nwsTimeString.slice(0,loc))
    return uts
}

function getDailySlug(uts) {
    let date = new Date(uts);
    let day = date.getDay() 
    const slug = ['Sun','Mon','Tue','Wed','Thr','Fri','Sat']
    return slug[day]    
}

function getHourlySlug(uts){
    let date = new Date(uts);
    let hr = date.getHours() 

    if (hr == 0)
        return "12AM"
    if (hr < 12)
        return hr + "AM"
    if (hr == 12)
        return "12PM"
    return (hr-12) + "PM"
}

function getUnits(property) {
    properties = jsonGridData["properties"]
    data = properties[property]
    return data["uom"]
}

function getSunrise() {
    utsSunrise = Date.parse( jsonSunriseSunset['results']['sunrise'])
    
    str = new Date(utsSunrise).toLocaleTimeString()
    loc = str.lastIndexOf(':')
    return str.slice(0,loc)
}
function getSunset() {
    utsSunset = Date.parse( jsonSunriseSunset['results']['sunset'])
    
    str = new Date(utsSunset).toLocaleTimeString()
    loc = str.lastIndexOf(':')
    return str.slice(0,loc)
}

function isDaylight(uts) {
    utsSunrise = Date.parse( jsonSunriseSunset['results']['sunrise'])
    utsSunset = Date.parse( jsonSunriseSunset['results']['sunset'])

    sunrise_hr = new Date(utsSunrise).getHours()
    sunrise_min = new Date(utsSunrise).getMinutes()
    sunrise_time = (sunrise_hr * 60) + sunrise_min

    sunset_hr = new Date(utsSunset).getHours()
    sunset_min = new Date(utsSunset).getMinutes()
    sunset_time = (sunset_hr * 60) + sunset_min

    hr = new Date(uts).getHours()
    min = new Date(uts).getMinutes()
    _time = (hr * 60) + min

    if (_time < sunrise_time)
        return false
    if (_time > sunset_time)
        return false
    return true
}

function sumHourlyData(min,max,property) {
    properties = jsonGridData["properties"]
    dataset = properties[property]["values"]

    total = 0.0
    for (idx=0; idx<dataset.length; idx++) {
        valid_time = nwsTimeToUTS(dataset[idx]['validTime'])
        if ((valid_time > min) && (valid_time <= max))
            total += dataset[idx]["value"]
        if ((valid_time > max))
            break
    }
    return total
}
function maxHourlyData(min,max,property) {
    properties = jsonGridData["properties"]
    dataset = properties[property]["values"]

    max_value = -1e6
    for (idx=0; idx<dataset.length; idx++) {
        valid_time = nwsTimeToUTS(dataset[idx]['validTime'])
        if ((valid_time > min) && (valid_time <= max))
            if (dataset[idx]["value"] > max_value)
                max_value = dataset[idx]["value"]
        if ((valid_time > max))
            break
    }
    return max_value
}

function getHourlyData(uts,property) {
    properties = jsonGridData["properties"]
    dataset = properties[property]["values"]

    value = NaN
    for (idx=0; idx<dataset.length; idx++) {
        valid_time = nwsTimeToUTS(dataset[idx]['validTime'])
        if (valid_time > uts)
            break
        value = dataset[idx]["value"]
    }
    return value
}

function getWxLabel(uts) {
    let skyCover = getHourlyData(uts,'skyCover')
    let snowfallAmt = getHourlyData(uts,'snowfallAmount')
    let pop = getHourlyData(uts,'probabilityOfPrecipitation')
    let pot = getHourlyData(uts,'probabilityOfThunder')
    let windGust = getHourlyData(uts,'windGust')
    let visibility = getHourlyData(uts,'visibility')
    let temp = getHourlyData(uts,'temperature')
    let daylight = isDaylight(uts)

    if (snowfallAmt > 25) 
        return 'Heavy Snow'
    if (snowfallAmt > 5) 
        return 'Snow'
    if (snowfallAmt > 0) 
        return 'Flurries'
    if (pot > 50) {
        return 'Thunderstorms'
    }
    if ((pop > 33) && (temp > 2)){
        if (windGust > 31) 
           return 'Stormy'
        return 'Rain'
    }
    if (visibility < 1600)
        return 'Foggy'
    if (windGust > 48.27)   // 48.27km = 30mph
        return 'Windy'
    if (skyCover > 66) 
        return 'Cloudy'
    if (skyCover > 33) {
        return 'Partly Cloudy'
    }

    if (daylight == true) 
        return 'Sunny'
    if (daylight == false) 
        return 'Clear'

    return ''
}

function getWxIcon(uts_min,uts_max,force_daylight) {
    uts = uts_min
    let skyCover = getHourlyData(uts,'skyCover')
    let snowfallAmt = sumHourlyData(uts_min,uts_max,'snowfallAmount')
    let pop = maxHourlyData(uts_min,uts_max,'probabilityOfPrecipitation')
    let pot = maxHourlyData(uts_min,uts_max,'probabilityOfThunder')
    let windGust = maxHourlyData(uts_min,uts_max,'windGust')
    let visibility = getHourlyData(uts,'visibility')
    let temp = maxHourlyData(uts_min,uts_max,'temperature')
    let daylight = isDaylight(uts)
    if (force_daylight == true)
        daylight  = true

    if (snowfallAmt > 25) 
        return 'snowheavy.png'
    if (snowfallAmt > 5) 
        return 'snow.png'
    if (pot > 50) {
        if (daylight == false)
            return 'lightningmoon.png'
        return 'lightning.png'
    }
    if ((pop > 33) && (temp > 2)){
        if (windGust > 31) 
            return 'windrain.png'
        if (daylight == false)
            return 'rainmoon.png'
        return 'rain.png'
    }
    if (visibility < 1600)
        return 'foggy.png'
    if (windGust > 48.27)   // 48.27km = 30mph
        return 'wind.png'
    if (skyCover > 66) 
        return 'cloudy.png'
    if (skyCover > 33) {
        if (daylight == false) 
            return 'pcloudymoon.png'
        return 'pcloudy.png'
    }

    if (daylight == true) 
        return 'sunny.png'
    if (daylight == false) 
        return 'clearmoon.png'

    return 'sunny.png'
}

function getDailyWx(now,deltaDay) {
    const d = new Date();               //  start looking for snow tommorow at 6:00AM
    let prev_midnight = GetMidnight() + ((deltaDay-1) * 24.0 * 60.0 * 60.0 * 1000.0)
    let next_midnight = GetMidnight() + (deltaDay * 24.0 * 60.0 * 60.0 * 1000.0)
    let uts = now + (deltaDay * 24.0 * 60.0 * 60.0 * 1000.0)
    let slug = getDailySlug(uts)

    let minTempTime = next_midnight
    if (d.getHours() <= 7)
        minTempTime = prev_midnight

    let windgusts = maxHourlyData(prev_midnight,next_midnight,'windGust')
    let wind_uom = getUnits('windGust')

    let maxtemp = getHourlyData(next_midnight,'maxTemperature')
    let mintemp = getHourlyData(minTempTime,'minTemperature')
    let temp_uom = getUnits('maxTemperature')

    let icon = getWxIcon(prev_midnight,next_midnight,true)

    let wx = {'slug':slug, 'icon':icon, 'temp_uom':temp_uom, 'maxtemp':maxtemp, 'mintemp':mintemp, 'wind_uom':wind_uom, 'windgusts':windgusts}
    return wx
}

function getHourlyWx(now,deltaHour){
    let d = new Date(now)
    let minute = d.getMinutes()
    let uts = now - (minute * 60 * 1000) + (deltaHour * 60.0 * 60.0 * 1000.0) 

    let slug = getHourlySlug(uts)
    let temp = getHourlyData(uts,'temperature')
    let temp_uom = getUnits('temperature')

    let winddir = getHourlyData(uts,'windDirection')
    let windgusts = getHourlyData(uts,'windGust')
    let wind_uom = getUnits('windGust')

    let precp_type = ''
    let snow_amnt = 0.0
    let rain_amnt = 0.0
    let pop = getHourlyData(uts,'probabilityOfPrecipitation')
    let snowfall = getHourlyData(uts,'snowfallAmount')
    if (snowfall > 0.0) {
        precp_type = 'Snow'
        snow_amnt = snowfall  / 6.0
    } else {
        let quantitativePrecipitation = getHourlyData(uts,'quantitativePrecipitation') 
        if (quantitativePrecipitation > 0.0) {
            precp_type = 'Rain'
            rain_amnt = quantitativePrecipitation   / 6.0       
        }
    }

    let icon = getWxIcon(uts,uts,false)

    let wx = {'slug':slug, 'icon':icon, 'temp_uom':temp_uom, 'temp':temp, 'wind_uom':wind_uom, 
                'windgusts':windgusts, 'winddir':winddir,'precp_type':precp_type,'pop':pop,
                'snow_amnt':snow_amnt, 'rain_amnt':rain_amnt   }
    return wx
}

function getTodaysWx() {
    let wxToday = []
    let slug = jsonDailyForecast['properties']['periods'][0]['name']
    let forecast = jsonDailyForecast['properties']['periods'][0]['detailedForecast']
    let shortForecast = jsonDailyForecast['properties']['periods'][0]['shortForecast']
    wxToday[0] = {'slug':slug, 'forecast':forecast, 'shortForecast':shortForecast}

    slug = jsonDailyForecast['properties']['periods'][1]['name']
    forecast = jsonDailyForecast['properties']['periods'][1]['detailedForecast']
    shortForecast = jsonDailyForecast['properties']['periods'][1]['shortForecast']
    wxToday[1] = {'slug':slug, 'forecast':forecast, 'shortForecast':shortForecast}

    return wxToday
}

function getShortForecast(forecast) 
{
    console.log('shorten : ' + forecast)
    idx = forecast.indexOf('then')
    if (idx > -1) {
        forecast = forecast.slice(0,idx)
    }

    return forecast
}

async function getSunriseSunset() {
    let wx_url = 'https://api.sunrise-sunset.org/json?formatted=0&'
    let wx_points = 'lat=39.9227&lng=-105.4049'
    let url = wx_url + wx_points
    try {
        let res = await fetch(url);
        return await res.json();
    } catch (error) {
        console.log("error")
        console.log(error);
    }
    return null
}


async function getNwsWsJSON(wx_url) {
    console.log(wx_url)

    try {
        let res = await fetch(wx_url);
        return await res.json();
    } catch (error) {
        console.log("error")
        console.log(error);
    }
    return null
}

async function getNwsLocationJSON(id) {
    let wx_url = 'https://api.weather.gov/points/'
    let wx_points = '39.9227,-105.4049'
    let url = wx_url + wx_points
    try {
        let res = await fetch(url);
        return await res.json();
    } catch (error) {
        console.log("error")
        console.log(error);
    }
    return null
}

