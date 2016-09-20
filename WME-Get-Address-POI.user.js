// ==UserScript==
// @name         WME getting info from 2GIS
// @namespace    https://greasyfork.org/ru/scripts/19633-wme-getting-info-from-2gis
// @version      0.1.7.18
// @description  Information from 2gis in landmark edit panel
// @author       coilamo & skirda
// @include      https://*.waze.com/editor/*
// @include      https://*.waze.com/*/editor/*
// @include      https://*.waze.com/map-editor/*
// @include      https://*.waze.com/beta_editor/*
// @grant        none
// Спасибо skirda за помощь в улучшении скрипта
// ==/UserScript==

var WME_2gis_version = '0.1.7.18';
var wazeActionAddLandmark = require("Waze/Action/AddLandmark");
var wazefeatureVectorLandmark = require("Waze/Feature/Vector/Landmark");
var wazefeatureEditorLandmark = require("Waze/Modules/FeatureEditor/Landmark");
var wazeActionUpdateFeatureAddress = require("Waze/Action/UpdateFeatureAddress");
var wazeActionUpdateObject = require("Waze/Action/UpdateObject");

var wme2GIS_debug=false;
var wme2GIS_dontselect=false;
var wme2GIS_changecat = false;
var wme2GIS_AddAddress=false;
var wme2GIS_UserRank=-1;
var wme2GIS_radius=10;
var wme2GIS_NavigationPoint=0; // размещать точки-пои рандомно, недалеко от точки входа
var wme2GIS_HNFormat=0;
var wme2GIS_DefCategory="OTHER";
var wme2GIS_osmmap=false;
var wme2GIS_yamap=false;
var wme2GIS_2gismap=false;
var wme2GIS_gmmap=false; // TODO!!!

//Waze.selectionManager.selectedItems[0].model.getNavigationPoint().point


function cloneConfig(obj)
{
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj)
    {
        if (obj.hasOwnProperty(attr))
        {
            copy[attr] = cloneConfig(obj[attr]);
        }
    }
    return copy;
}

function CreateID()
{
    return 'WME-2Gis-' + WME_2gis_version.replace(/\./g,"-");
}

function PtInPoly(x, y, components)
{
    npol = components.length;
    jj = npol - 1;
    var c = 0;
    for (var ii = 0; ii < npol;ii++)
    {
        if ((((components[ii].y<=y) && (y<components[jj].y)) || ((components[jj].y<=y) && (y<components[ii].y))) &&
            (x > (components[jj].x - components[ii].x) * (y - components[ii].y) / (components[jj].y - components[ii].y) + components[ii].x))
        {
            c = !c;
        }
        jj = ii;
    }
    return c;
}

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}


function wme_2gis() {
    console.log('Starting wme_2gis');
    if (typeof Waze === "undefined")
    {
        console.log("undef Waze");
        setTimeout(wme_2gis,500);
        return;
    }
    if (typeof Waze.selectionManager === "undefined")
    {
        console.log("undef Waze.selectionManager");
        setTimeout(wme_2gis,500);
        return;
    }
    if (typeof Waze.model === "undefined")
    {
        console.log("undef Waze.model");
        setTimeout(wme_2gis,500);
        return;
    }
    if (typeof Waze.loginManager === "undefined")
    {
        console.log("undef Waze.loginManager");
        setTimeout(wme_2gis,500);
        return;
    }
    if (typeof Waze.loginManager.user === "undefined" || Waze.loginManager.user === null)
    {
        console.log("Waze.loginManager.user undefined OR null");
        setTimeout(wme_2gis,500);
        return;
    }

    try {
        Waze.selectionManager.events.register("selectionchanged", null, wme_2gis_InserHTML);
    }
    catch (err) {
        console.log('wme_2gis error: '+err.message);
    }

    wme2GIS_AddAddress = __GetLocalStorageItem("wme2GIS_AddAddress",'bool',false);

    wme2GIS_dontselect = __GetLocalStorageItem("wme2GIS_dontselect",'bool',false);

    wme2GIS_changecat = __GetLocalStorageItem("wme2GIS_changecat",'bool',false);

    wme2GIS_NavigationPoint = __GetLocalStorageItem("wme2GIS_NavigationPoint",'int',0);

    wme2GIS_HNFormat = __GetLocalStorageItem("wme2GIS_HNFormat",'int',0);

    wme2GIS_radius = __GetLocalStorageItem("wme2GIS_radius",'int',10);

    try {
        wme2GIS_UserRank = __GetLocalStorageItem("wme2GIS_UserRank",'int',Waze.loginManager.user.rank);
    }
    catch (err) {
        console.log('wme_2gis error: '+err.message);
    }

    try {
        wme2GIS_DefCategory = __GetLocalStorageItem("wme2GIS_DefCategory",'arr','PROFESSIONAL_AND_PUBLIC',I18n.translations[I18n.locale].venues.categories);
    }
    catch (err) {
        console.log('wme_2gis error: '+err.message);
    }

    setTimeout(wme_2gis_initBindPoi, 500);
    setTimeout(Wme2Gis_InitConfig, 500);
}


function wme_2gis_InserHTML() {
    if (wme2GIS_debug) console.log("wme_2gis_InserHTML()");

    if (Waze.selectionManager.selectedItems.length > 0 && Waze.selectionManager.selectedItems[0].model.type === "venue") {
        if (wme2GIS_debug) console.log('wme_2gis_InserHTML');

        $('#landmark-edit-general').prepend(
            '<div class="form-group"> \
<label class="control-label">External POI (version ' + WME_2gis_version + ')</label> \
<div class="controls"> \
<div id="2gis0"><div id="2gis"></div><div id="map_2gis"></div></div> \
<div id="gm0"><div id="gm"></div><div id="street-view"></div></div> \
<div id="ym0"><div id="ym"></div><div id="map_ya"></div></div> \
<div id="osm0"><div id="osm"></div><div id="map_osm"></div></div> \
</div> \
</div> \
</div>'
        );
        var div2gis = document.getElementById('2gis');
        var divGm = document.getElementById('gm');
        var divYm = document.getElementById('ym');
        var divOsm = document.getElementById('osm');

        document.getElementById("map_2gis").setAttribute('style',wme2GIS_2gismap?'width:275px; height:275px':'display:none;');
        document.getElementById("map_ya").setAttribute('style',wme2GIS_yamap?'width:275px; height:275px':'display:none;');
        document.getElementById("map_osm").setAttribute('style',wme2GIS_osmmap?'width:275px; height:275px':'display:none;');
        document.getElementById("street-view").setAttribute('style',wme2GIS_gmmap?'width:275px; height:275px':'display:none;');

        //getting lon/lat selected point
        var poi_id=Waze.selectionManager.selectedItems[0].model.attributes.id;
        //if (wme2GIS_debug) console.log(Waze.model.venues.get(poi_id).geometry);

        // координаты всегда берём от мыши
        var mc=document.getElementsByClassName('WazeControlMousePosition')[0].lastChild.innerHTML.split(' ');
        var x=mc[0];
        var y=mc[1];
        var poiPos=new OpenLayers.LonLat(x,y);
        if (wme2GIS_debug) console.log("https://www.waze.com/ru/editor/?env=row&lon="+poiPos.lon+"&lat="+poiPos.lat+"&zoom=7&marker=yes");

        //2GIS
        var url = 'https://catalog.api.2gis.ru/2.0/geo/search';
        var data = {
            "point": poiPos.lon + ',' + poiPos.lat,
            "format": "json",
            "fields": "items.links",
            "key": "rubnkm7490"
        };

        $.ajax({
            dataType: "json",
            cache: false,
            url: url,
            data: data,
            error: function() {
            },
            success: function(json) {
                if(!json.result)
                {
                    document.getElementById("map_2gis").setAttribute('style','display:none;');
                    return;
                }
                if(wme2GIS_2gismap){
                    var script2   = document.createElement('script');
                    script2.type  = "text/javascript";
                    var s = document.getElementsByTagName('head')[0].appendChild(script2);
                    s.innerHTML='var map; DG.then(function () {map = DG.map(\'map_2gis\', {center: [' + poiPos.lat + ',' + poiPos.lon + '],zoom: 17,fullscreenControl: false,zoomControl: false});});';
                }

                div2gis.innerHTML = '2GIS: ' + json.result.items[0].full_name + '<br/>';

                // у точки не отображаем организайии, если она в пределах родителя
                var ispoint=Waze.selectionManager.hasSelectedItems() && Waze.selectionManager.selectedItems[0].model.attributes.geometry.id.indexOf(".Point") >= 0;
                var found=false;
                if(ispoint)
                {
                    for(var i in Waze.model.venues.objects) // ищем родителя
                    {
                        var v=Waze.model.venues.get(i);
                        if (v.attributes.geometry.id.indexOf(".Point") < 0) // исключаем точки
                        {
                            var poiCoord=new OpenLayers.LonLat(poiPos.lon,poiPos.lat);
                            poiCoord.transform(new OpenLayers.Projection("EPSG:4326"),new OpenLayers.Projection("EPSG:900913"));
                            if (PtInPoly(poiCoord.lon,poiCoord.lat,v.attributes.geometry.components[0].components))
                            {
                                found=true;
                                break;
                            }
                        }
                        if(found)
                            break;
                    }
                }
                if (wme2GIS_debug) console.log("wme_2gis_InserHTML(): found parent="+found);
                if (!found)
                {
                    if(json.result.items.length > 0)
                    {
                        if(json.result.items[0].links && typeof (json.result.items[0].links) === "object")
                        {
                            if(typeof (json.result.items[0].links.branches) !== "undefined")
                            {
                                div2gis.innerHTML += '<div id="poi_2gis" style="width:275px;"><a href="#" id="getListPoi">Организации в здании</a></div>';
                                document.getElementById('getListPoi').onclick = getListPOI;
                                document.getElementById('getListPoi').setAttribute('building_id', json.result.items[0].id);
                                document.getElementById('getListPoi').setAttribute('lat', poiPos.lat);
                                document.getElementById('getListPoi').setAttribute('lon', poiPos.lon);
                                document.getElementById('getListPoi').setAttribute('page', 1);
                            }
                        }
                    }
                }
            }
        });

        //google maps
        var gm_url = 'https://maps.googleapis.com/maps/api/geocode/json';
        var gm_data = {
            "latlng": poiPos.lat + ',' + poiPos.lon
        };

        $.ajax({
            dataType: "json",
            cache: false,
            url: gm_url,
            data: gm_data,
            error: function() {
            },
            success: function(json) {
                if(!json.results)
                {
                    document.getElementById("street-view").setAttribute('style','display:none;');
                    return;
                }
                var gm_obj = json.results[0].address_components;
//window.gm_obj=gm_obj;
                if(gm_obj[0].long_name !== 'Unnamed Road') {
                    divGm.innerHTML='GM: <a href="#" id="gm_storeaddress" title="Заполнить адрес">'+gm_obj[0].long_name + ', ' + gm_obj[1].long_name+'</a>';

                    //var StreetViewPanorama=
                    new google.maps.StreetViewPanorama(
                        document.getElementById('street-view'),
                        {
                            position: {lat: poiPos.lat, lng: poiPos.lon},
                            pov: {heading: 165, pitch: 0},
                            zoom: 1
                        });
                    // StreetViewPanorama.setPov({ heading: 90, pitch: 0, zoom: 1 })

                    document.getElementById('gm_storeaddress').onclick =  __ModityAddressYM;
                    if(gm_obj[2].long_name !== null)
                        document.getElementById('gm_storeaddress').setAttribute('cityName', gm_obj[2].long_name);
                    if(gm_obj[1].long_name !== null)
                        document.getElementById('gm_storeaddress').setAttribute('streetName', gm_obj[1].long_name);
                    if(gm_obj[0].long_name !== null)
                        document.getElementById('gm_storeaddress').setAttribute('houseNumber', gm_obj[0].long_name);
                }
                else
                {
                    document.getElementById("street-view").setAttribute('style','display:none;');
                    divGm.innerHTML='GM: ЗДЕСЬ РЫБЫ НЕТ!'; //!!!!!
                }
            }
        });

        //yandex maps
        var ym_url = 'https://geocode-maps.yandex.ru/1.x/';
        var ym_data = {
            "geocode": poiPos.lon + ',' + poiPos.lat,
            "format":"json"
        };

        $.ajax({
            dataType: "json",
            cache: false,
            url: ym_url,
            data: ym_data,
            error: function() {
            },
            success: function(json) {
                if(!json.response)
                {
                    document.getElementById("map_ya").setAttribute('style','display:none;');
                    return;
                }

                function findSomething(object, name) {
                    //if (wme2GIS_debug) console.log(object);
                    if (name in object) return object[name];
                    for (key in object) {
                        if ((typeof (object[key])) == 'object') {
                            var t = findSomething(object[key], name);
                            if (t) return t;
                        }
                    }
                    return null;
                }

                var ym_obj = json.response.GeoObjectCollection.featureMember[0].GeoObject;
                var cityName = findSomething(ym_obj, "LocalityName");
                var streetName;
                if(findSomething(ym_obj, "ThoroughfareName") !== null) {
                    streetName = findSomething(ym_obj, "ThoroughfareName");
                } else if(findSomething(ym_obj, "DependentLocalityName") !== null) {
                    streetName = findSomething(ym_obj, "DependentLocalityName");
                }
                var houseNumber = findSomething(ym_obj, "PremiseNumber");

                var innerHTML=((houseNumber !== undefined && houseNumber !== null) || wme2GIS_yamap)?'YM: ':'';
                if(houseNumber !== undefined && houseNumber !== null)
                    innerHTML+='<a href="#" id="ym_storeaddress" title="Заполнить адрес">' + houseNumber + ', ' + streetName + '</a>';
                divYm.innerHTML=innerHTML;

                if(houseNumber !== undefined && houseNumber !== null)
                {
                    if (document.getElementById('ym_storeaddress')) document.getElementById('ym_storeaddress').onclick =  __ModityAddressYM;
                    var ym_locality = findSomething(ym_obj, "LocalityName");
                    if(typeof(ym_locality.DependentLocality) !== undefined) ym_locality = ym_locality.DependentLocality;

                    if(cityName !== null && document.getElementById('ym_storeaddress'))
                        document.getElementById('ym_storeaddress').setAttribute('cityName', cityName);
                    if(streetName !== null && document.getElementById('ym_storeaddress'))
                        document.getElementById('ym_storeaddress').setAttribute('streetName', streetName);
                    if(houseNumber !== null && document.getElementById('ym_storeaddress'))
                        document.getElementById('ym_storeaddress').setAttribute('houseNumber', houseNumber);
                }

                if(wme2GIS_yamap){
                    var map = new ymaps.Map("map_ya", {
                        center: [poiPos.lat, poiPos.lon],
                        zoom: 17,
                        controls: ["zoomControl", "fullscreenControl"]
                    });
                }
            }
        });

        //OSM
        var osm_url = 'https://nominatim.openstreetmap.org/reverse';
        var osm_data = {
            "lat": poiPos.lat,
            "lon": poiPos.lon,
            "zoom": 20,
            "format": "json",
            "addressdetails": 1,
            "countrycodes":"ru",
            "accept-language": "Ru_ru"
        };

        $.ajax({
            dataType: "json",
            cache: false,
            url: osm_url,
            data: osm_data,
            error: function() {
            },
            success: function(json) {
                if(!json.address)
                {
                    document.getElementById("map_osm").setAttribute('style','display:none;');
                    return;
                }
                var osm_obj = json.address;

                if(!(osm_obj.house_number !== undefined || wme2GIS_osmmap))
                {
                    document.getElementById("map_osm").setAttribute('style','display:none;');
                    return; // лишнее не отображаем
                }

                var innerHTML=osm_obj.house_number !== undefined || wme2GIS_osmmap?'OSM: ':'';
//window.osm_obj=osm_obj;
                if(osm_obj.house_number !== undefined)
                    innerHTML+='<a href="#" id="osm_storeaddress" title="Заполнить адрес">'+osm_obj.house_number + ', ' + osm_obj.road + '</a>';

                divOsm.innerHTML=innerHTML;

                if(osm_obj.house_number !== undefined)
                {
                    if (document.getElementById('osm_storeaddress'))
                    {
                       document.getElementById('osm_storeaddress').onclick =  __ModityAddressYM;
                       document.getElementById('osm_storeaddress').setAttribute('cityName', osm_obj.city);
                       document.getElementById('osm_storeaddress').setAttribute('streetName', osm_obj.road);
                       document.getElementById('osm_storeaddress').setAttribute('houseNumber', osm_obj.house_number);
                    }
                }
                if(wme2GIS_osmmap)
                {
                    //Google maps API initialisation
                    var element = document.getElementById("map_osm");

                    var map = new google.maps.Map(element, {
                        center: new google.maps.LatLng(poiPos.lat, poiPos.lon),
                        zoom: 17,
                        mapTypeId: "OSM",
                        mapTypeControl: false,
                        streetViewControl: false
                    });

                    //Define OSM map type pointing at the OpenStreetMap tile server
                    map.mapTypes.set("OSM", new google.maps.ImageMapType({
                        getTileUrl: function(coord, zoom) {
                            return "http://tile.openstreetmap.org/" + zoom + "/" + coord.x + "/" + coord.y + ".png";
                        },
                        tileSize: new google.maps.Size(256, 256),
                        name: "OpenStreetMap",
                        maxZoom: 18
                    }));
                }
            }
        });

    }
    return;
}

function __ModityAddressYM()
{
    var cityName=this.getAttribute('cityname');
    if (wme2GIS_debug) console.log(cityName);
    var streetName=this.getAttribute('streetname');
    if (wme2GIS_debug) console.log(streetName);
    var houseNumber=this.getAttribute('housenumber');
    if (wme2GIS_debug) console.log(houseNumber);
    var mod=false;

    function GetControlName(id)
    {
        var beta = (location.hostname == "editor-beta.waze.com"?true:false);
        switch(id)
        {
            case 'form':
                return beta?".edit-button":".edit-button";
            case 'cityname':
                return beta?'class="city-name form-control"':'class="city-name form-control"';
            case 'citynamecheck':
                return beta?".empty-city":".empty-city";
            case 'streetname':
                return beta?'class="form-control street-name"':'class="form-control street-name"';
            case 'streetnamecheck':
                return beta?".empty-street":".empty-street";
            case 'housenumber':
                return beta?'class="form-control house-number"':'class="form-control house-number"';
            case 'save':
                return beta?'class="btn btn-primary save-button"':'class="btn btn-primary save-button"';
            case 'cancel':
                return beta?'class="btn btn-default cancel-button"':'class="btn btn-default cancel-button"';
            case 'name':
                return "name";
        }
        return '';
    }

    // кликаем кнопку изменение адреса
    $(GetControlName('form')).click();

    // открылась форма
    setTimeout(function() {
        var res=null;

        // ** обработка имени стрита **
        if(streetName && streetName !== "")
        {
            //блок по преобразованию имени стрита к нашему виду.
            var wmeStreetName;
            var streets=[];
            var i=0;
            for(i in Waze.model.streets.objects)
            {
                if (wme2GIS_debug) console.log("Waze.model.streets.objects["+i+"].getAttributes().name="+Waze.model.streets.objects[i].getAttributes().name);
                if (Waze.model.streets.objects[i].getAttributes().name)
                    streets.push({"name": Waze.model.streets.objects[i].getAttributes().name});
            }

            if (wme2GIS_debug) {console.log("streets:");console.log(streets);}
            var options = {
                caseSensitive: false,
                includeScore: false,
                shouldSort: true,
                tokenize: true,
                threshold: 0.6,
                location: 0,
                distance: 100,
                maxPatternLength: 32,
                keys: ["name"]
            };
            var f = new Fuse(streets, options);
            wmeStreetName = f.search(streetName);
            if (wme2GIS_debug) console.log(wmeStreetName[0].name);

            if($('input['+GetControlName('streetname')+']').val() !== wmeStreetName[0].name) {

                // если чекед ("без улицы") - сделать uncheck (разлочить строку ввода)
                if ($(GetControlName('streetnamecheck'))[0].checked)
                    $(GetControlName('streetnamecheck')).click();
                //если имя не пустое, сообщаем, что мы его меняем
                if($('input['+GetControlName('streetname')+']').val().length) {
                    if(confirm('Изменить улицу ' + $('input['+GetControlName('streetname')+']').val() + ' -> ' + wmeStreetName[0].name + '?'))
                    {
                        // ставим имя стрита в адрес
                        $('input['+GetControlName('streetname')+']').val(wmeStreetName[0].name).change();
                        mod=true;
                    }
                }else{
                    // ставим имя стрита в адрес
                    $('input['+GetControlName('streetname')+']').val(wmeStreetName[0].name).change();
                    mod=true;
                }
            }
        }

        // ** обработка номера дома **
        if(houseNumber && houseNumber !== "")
        {
            // удаляем пробелы
            houseNumber=houseNumber.replace(/\s+/g, '');
            // сокращаем
            houseNumber=houseNumber.replace(/корпус/g, 'к');
            houseNumber=houseNumber.replace(/строение/g, 'с');
            houseNumber=houseNumber.replace(/владение/g, 'вл');

            switch(wme2GIS_HNFormat){
                case 0:
                    // коррекция в соответствии с 2gis
                    houseNumber=houseNumber.toLowerCase();
                    if (houseNumber.indexOf("б") > -1) // "Б" делаем большим
                        houseNumber=houseNumber.toUpperCase();
                    break;
                case 1:
                    // коррекция в соответствии с yandex
                    houseNumber=houseNumber.toUpperCase();
                    if (houseNumber.indexOf("К") > -1) houseNumber=houseNumber.substring(0,houseNumber.lastIndexOf("К")) + houseNumber.substring(houseNumber.lastIndexOf("К"), houseNumber.lastIndexOf("К")+1).toLowerCase() + houseNumber.slice(houseNumber.lastIndexOf("К")+1);
                    if (houseNumber.indexOf("С") > -1) houseNumber=houseNumber.substring(0,houseNumber.lastIndexOf("С")) + houseNumber.substring(houseNumber.lastIndexOf("С"), houseNumber.lastIndexOf("С")+1).toLowerCase() + houseNumber.slice(houseNumber.lastIndexOf("С")+1);
                    if (houseNumber.indexOf("ВЛ") > -1) houseNumber=houseNumber.substring(0,houseNumber.lastIndexOf("ВЛ")) + houseNumber.substring(houseNumber.lastIndexOf("ВЛ"), houseNumber.lastIndexOf("ВЛ")+2).toLowerCase() + houseNumber.slice(houseNumber.lastIndexOf("ВЛ")+2);
                    if (houseNumber.indexOf("ДВ") > -1) houseNumber=houseNumber.substring(0,houseNumber.lastIndexOf("ДВ")) + houseNumber.substring(houseNumber.lastIndexOf("ДВ"), houseNumber.lastIndexOf("ДВ")+2).toLowerCase() + houseNumber.slice(houseNumber.lastIndexOf("ДВ")+2);
                    break;
                case 2:
                    // коррекция в соответствии с BY
                    houseNumber=houseNumber.toUpperCase();
                    houseNumber=houseNumber.replace('К', '/');
                    break;
                default:
                    break;
            }

            // валидация


            // выносим номер дома в название (если пусто)
            if($('input[name="name"]').length > 1)
            {
                for(var ii=0; ii < $('input[name="name"]').length; ++ii)
                {
                    if (typeof ($($('input[name="name"]')[ii]).attr("id")) === "undefined" && !$($('input[name="name"]')[ii]).val())
                    {
                        $($('input[name="name"]')[ii]).val(houseNumber).change();
                        break;
                    }
                }
            }
            else
            {
                if(!$('input[name="name"]').val())
                    $('input[name="name"]').val(houseNumber).change();
                else if($('input[name="name"]').val() !== houseNumber) {
                    if(confirm ("Изменить Название POI "+$('input[name="name"]').val()+"->"+houseNumber+"?")) {
                        $('input[name="name"]').val(houseNumber).change();
                    }
                }
            }

            //ставим лок
            if (wme2GIS_debug) console.log("__ModityAddressYM(): userRank="+wme2GIS_UserRank);

            if($('select[name="lockRank"]').val() !== wme2GIS_UserRank)
                $('select[name="lockRank"]').val(wme2GIS_UserRank).change();

            // если ХН пусто или не совпадает с новым
            if(!$('input['+GetControlName('housenumber')+']').val() || $('input['+GetControlName('housenumber')+']').val() !== houseNumber)
            {
                // ... допустимо только " 'цифр в количестве от 1 до 6' И_ВОЗМОЖНО ('буквы' ИЛИ '/буквы' ИЛИ '/цифры') "
                if(/^\d{1,6}(([а-яА-Я]*)|(\/{1}(([а-яА-Я]+)|([0-9]+))))$/.test(houseNumber))
                {
                    // можно ставить ХН
                    $('input['+GetControlName('housenumber')+']').val(houseNumber).change();
                    mod=true;
                }
            }
        }

        // ** обработка имени НП **
        if (wme2GIS_debug) console.log("cityName="+cityName)
        if(cityName && cityName !== "")
        {
            if (wme2GIS_debug) console.log("start CITYS");
            //блок по преобразованию имени сити к нашему виду.
            var wmeCityName;
            var citys=[];
            var i=0;
            for(i in Waze.model.cities.objects)
            {
                var name_c=Waze.model.cities.objects[i].getAttributes().name;
                if (wme2GIS_debug) console.log("Waze.model.cities.objects["+i+"].getAttributes().name="+name_c);
                //if (name_c)
                    citys.push({"name": name_c});
            }

            if (wme2GIS_debug) { console.log("citys:"); console.log(citys); }
            var options = {
                caseSensitive: false,
                includeScore: false,
                shouldSort: true,
                tokenize: true,
                threshold: 0.6,
                location: 0,
                distance: 100,
                maxPatternLength: 32,
                keys: ["name"]
            };
            var f = new Fuse(citys, options);
            wmeCityName = f.search(cityName);
            if (wme2GIS_debug) console.log("wmeCityName[0].name="+wmeCityName[0].name);

            if($('input['+GetControlName('cityname')+']').val() !== wmeCityName[0].name) {

                // если чекед ("без НП") - сделать uncheck (разлочить строку ввода)
                if ($(GetControlName('citynamecheck'))[0].checked)
                    $(GetControlName('citynamecheck')).click();
                //если имя не пустое, сообщаем, что мы его меняем
                if($('input['+GetControlName('cityname')+']').val().length) {
                    if(confirm('Изменить НП ' + $('input['+GetControlName('cityname')+']').val() + ' -> ' + wmeCityName[0].name + '?'))
                    {
                        // ставим имя стрита в адрес
                        $('input['+GetControlName('cityname')+']').val(wmeCityName[0].name).change();
                        mod=true;
                    }
                }else{
                    // ставим имя стрита в адрес
                    $('input['+GetControlName('cityname')+']').val(wmeCityName[0].name).change();
                    mod=true;
                }
            }
        }

        if (wme2GIS_debug) console.log("GetControlName('save')="+GetControlName('save'));
        $('button['+(mod ?GetControlName('save'):GetControlName('cancel'))+']').click();
    }, 60);

    // Меняем категорию на по умолчанию
    //console.log("$('.category').attr('data-category')="+ $('.category').attr('data-category') +", wme2GIS_DefCategory="+ wme2GIS_DefCategory +", wme2GIS_changecat="+ wme2GIS_changecat)
    if($('.category').attr('data-category') !== "OTHER"/*wme2GIS_DefCategory*/ && wme2GIS_changecat) {
        if(confirm('Изменить тип пои с ' + $('.category').attr('data-category') + ' на ' + "OTHER"/*wme2GIS_DefCategory*/)) {
            $('.remove-choice').each(function(o){this.click();}); //сначала удаляем что есть
            $('div[data-category='+"OTHER"/*wme2GIS_DefCategory*/+']').click();
        }
    }
}

function getListPOI(){
    if (wme2GIS_debug) console.log("getListPOI()");
    var building_id=this.getAttribute('building_id');
    var lonc=this.getAttribute('lon');
    var latc=this.getAttribute('lat');
    var page=this.getAttribute('page');

    var url = 'https://catalog.api.2gis.ru/2.0/catalog/branch/list';
    var data = {
        "building_id": building_id,
        "fields": "items.point",
        "page_size": 50,
        "page": page,
        "key": "rubnkm7490"
    };

    $.ajax({
        dataType: "json",
        cache: false,
        url: url,
        data: data,
        error: function() {
        },
        success: function(json) {
            if (wme2GIS_debug) console.dir(json)
            if(json.meta.error === undefined) {
                var total = parseInt(json.result.total);
                var poi_list='';
                for (var i = 0; i < total; i++) {
                    if(json.result.items[i] === undefined) break;
                    if(__GetLocalStorageItem("wme2GIS_id_" + json.result.items[i].id.split("_")[0],'bool',false)) poi_list+='<a href="#" style="padding-right:5px;" class="fa fa-check-square" poi="' + json.result.items[i].id.split("_")[0] + '"></a>';
                    else poi_list+='<a href="#" style="padding-right:5px;display:none;" class="fa fa-check-square" poi="' + json.result.items[i].id.split("_")[0] + '"></a>';
                    poi_list = poi_list + (i+1+(page-1)*50) + '.'
                        +' <a href="#"'
                        +' class="create-poi"'
                        +' lon="' + json.result.items[i].point.lon + '"'
                        +' lat="' + json.result.items[i].point.lat + '"'
                        +' poi_id="' + json.result.items[i].id + '"'
                        +' lonc="' + lonc + '"'
                        +' latc="' + latc + '"'
                        +'>' + json.result.items[i].name + '</a><br/>';
                }
                if(total > 50 && Math.floor(total/50) >= page)
                    poi_list+='<a href="#" id="nextListPoi">Следующие</a><hr/>';
                else
                    poi_list+='<hr/>';
                $("#poi_2gis").html(poi_list);
                if(total > 50 && Math.floor(total/50) >= page) {
                    document.getElementById('nextListPoi').onclick = getListPOI;
                    document.getElementById('nextListPoi').setAttribute('building_id', building_id);
                    document.getElementById('nextListPoi').setAttribute('lat', latc);
                    document.getElementById('nextListPoi').setAttribute('lon', lonc);
                    document.getElementById('nextListPoi').setAttribute('page', parseInt(page)+1);
                }
                $('.fa-check-square').click(function(){
                    localStorage.setItem('wme2GIS_id_' + this.getAttribute('poi'), 0);
                    console.log('wme2GIS_id_' + this.getAttribute('poi'));
                    this.remove();
                });
            }else{
                $("#poi_2gis").html(json.meta.error.message);
            }

            $('.create-poi').click(function(){
                //if (wme2GIS_debug) console.log(this.getAttribute('name') + '/' + this.getAttribute('lon') + '/' + this.getAttribute('lat'));
                var poiCoord=new OpenLayers.LonLat(this.getAttribute('lon'),this.getAttribute('lat'));
                poiCoord.transform(new OpenLayers.Projection("EPSG:4326"),new OpenLayers.Projection("EPSG:900913"));
                if (wme2GIS_debug) console.log('[' + poiCoord.lon + '/' + poiCoord.lat + '], [' + this.getAttribute('latc') + '/' + this.getAttribute('lonc') + ']');
                createPOI({
                    x: poiCoord.lon,
                    y: poiCoord.lat,
                    poi_id: this.getAttribute('poi_id'),
                    lat: this.getAttribute('latc'),
                    lon: this.getAttribute('lonc')
                });
            });
        }
    });
}


function createPOI (poiobject) {
    if (wme2GIS_debug) console.log("createPOI("+JSON.stringify(poiobject)+")");
    /*
        poiobject:
            x, y - координаты (2гис)
            lat,lon - координаты клика мыши (WME)
            poi_id - это уникальный идентификатор создаваемого ПОИ (2гис)
    */
    var url = 'https://catalog.api.2gis.ru/2.0/catalog/branch/get';
    var data = {
        "id": poiobject.poi_id,
        "format": "json",
        "fields": "items.adm_div,items.region_id,items.reviews,items.point,items.links,items.name_ex,items.org,items.group,items.see_also,items.dates,items.external_content,items.flags,items.ads.options,items.email_for_sending.allowed,hash,search_attributes",
        "key": "rubnkm7490"
    };

    $.ajax({
        dataType: "json",
        cache: false,
        url: url,
        data: data,
        error: function() {
        },
        success: function(json) {
            var json_poi = json.result.items[0];
            var poi = new wazefeatureVectorLandmark();
            var geometry = new OpenLayers.Geometry.Point();
            var rnd_meter=wme2GIS_radius;

            switch(wme2GIS_NavigationPoint)
            {
                case 0: // около точки входа (rnd_meter - в пределах скольки метров)
                    geometry.x=Waze.selectionManager.selectedItems[0].model.getNavigationPoint().point.x+((Math.random()*10) & 1 ?+1:-1)*(Math.random()*rnd_meter);
                    geometry.y=Waze.selectionManager.selectedItems[0].model.getNavigationPoint().point.y+((Math.random()*10) & 1 ?+1:-1)*(Math.random()*rnd_meter);
                    break;

                case 1: // там, где кликнули мышкой
                    var poiPos=new OpenLayers.LonLat(poiobject.lon,poiobject.lat);
                    // здесь требуется преобразование координат
                    poiPos.transform(new OpenLayers.Projection("EPSG:4326"),new OpenLayers.Projection("EPSG:900913"));
                    geometry.x = poiPos.lon;
                    geometry.y = poiPos.lat;
                    break;

                case 2: // рандомно, в пределах родиетльского ПОИ
                    while(1)
                    {
                        geometry.x = poiobject.x+((Math.random()*10) & 1 ?+1:-1)*(Math.random()*100);
                        geometry.y = poiobject.y+((Math.random()*10) & 1 ?+1:-1)*(Math.random()*100);
                        if (PtInPoly(geometry.x,geometry.y,Waze.selectionManager.selectedItems[0].model.attributes.geometry.components[0].components))
                            break;
                    }
                    break;
                case 3: // около точки входа 2GIS
                    var entrance_2gis = [];
                    if (typeof json_poi.links.entrances !== "undefined")
                        entrance_2gis = json_poi.links.entrances[0].geometry.points[0].replace(/.*\(([0-9\.]+) ([0-9\.]+)\)/,"$1 $2").split(" ");
                    else
                    {
                        entrance_2gis.push(json_poi.point.lon);
                        entrance_2gis.push(json_poi.point.lat);
                    }
                    var entrancePos=new OpenLayers.LonLat(entrance_2gis[0], entrance_2gis[1]);
                    // здесь требуется преобразование координат
                    entrancePos.transform(new OpenLayers.Projection("EPSG:4326"),new OpenLayers.Projection("EPSG:900913"));
                    geometry.x=entrancePos.lon+((Math.random()*10) & 1 ?+1:-1)*(Math.random()*rnd_meter);
                    geometry.y=entrancePos.lat+((Math.random()*10) & 1 ?+1:-1)*(Math.random()*rnd_meter);
                    break;
            }

            if (wme2GIS_debug) console.log("geometry="+JSON.stringify(geometry));
            poi.geometry = geometry;
            poi.attributes.categories=Waze.selectionManager.selectedItems[0].model.attributes.categories.clone();
            poi.attributes.categories.length=0;

            if(json_poi.rubrics !== undefined && typeof wme2Gis_categories[json_poi.rubrics[0].alias] !== "undefined") { //ищем категорию в нашем массиве
                poi.attributes.categories.push(wme2Gis_categories[json_poi.rubrics[0].alias]);
                if (wme2GIS_debug) console.log('Subrubric found');
            }
            else if(json_poi.rubrics !== undefined && typeof wme2Gis_categories[rubricAlias=getRubricAlias(json_poi.rubrics[0].parent_id)] !== "undefined") { //ищем категорию родителя в нашем массиве
                poi.attributes.categories.push(wme2Gis_categories[rubricAlias]);
                if (wme2GIS_debug) console.log('Rubric found, ');
            }
            else {
                poi.attributes.categories.push(wme2GIS_DefCategory);
            }
            if (wme2GIS_debug) console.dir(json_poi.rubrics);
            if (wme2GIS_debug) console.log("json_poi.rubrics[0].alias="+json_poi.rubrics[0].alias);
            var poi_name = json_poi.name;
            for (var key in wme2Gis_replacement) {
                poi_name = poi_name.replace(new RegExp(key,'ig'), wme2Gis_replacement[key]);
                if (wme2GIS_debug) console.log("replace '"+key+"'=>'"+wme2Gis_replacement[key]+"'");
            }
            poi.attributes.name = poi_name;

            var address=Waze.selectionManager.selectedItems[0].model.getAddress().attributes;
            /* var description=((typeof json_poi.name_ex.extension !== "undefined")?json_poi.name_ex.extension:"");
            if(description.length > 0)
                description+=', '
            */
            var description=wme2GIS_AddAddress?json_poi.address_name:"";
            description+=((typeof json_poi.address_comment !== "undefined")?(description.length > 0?", ":"") + json_poi.address_comment:"");
            poi.attributes.description=description;
            poi.attributes.lockRank=wme2GIS_UserRank;
            poi.attributes.houseNumber=address.houseNumber;
            var poi_al=new wazeActionAddLandmark(poi);
            Waze.model.actionManager.add(poi_al);
            window.poi0=poi;    // для анализа :-)
            window.poi1=poi_al; // для анализа :-)
            console.log(address);
            // корректировка стрита - по другому пока никак :-(
            var newAddressAtts={streetName: address.street.name, emptyStreet: false, cityName: address.city.attributes.name, emptyCity: false, stateID: address.state.id, countryID: address.country.id};
            Waze.model.actionManager.add(new wazeActionUpdateFeatureAddress(poi, newAddressAtts, {streetIDField: 'streetID'} ));

            // обеспечим автовыделение вновь созданного пои
            if (!wme2GIS_dontselect) Waze.selectionManager.select([poi_al.landmark]);
            if (wme2GIS_debug) console.log(json_poi.rubrics);
            // сохраним информацию о пои в локальное хранилище
            localStorage.setItem("wme2GIS_id_" + json_poi.id, 1);
            // ставим галочку
            $('[poi='+json_poi.id+']').css("display","inline-block");
        }
    });

}


function getRubricAlias(rubric_id) {
    var rubricAlias;
    var url = 'https://catalog.api.2gis.ru/2.0/catalog/rubric/get';
    var data = {
        "id": rubric_id,
        "key": "rubnkm7490"
    };

    $.ajax({
        dataType: "json",
        cache: false,
        async: false,
        url: url,
        data: data,
        error: function() {
        },
        success: function(json) {
            if(json.result.items[0].parent_id === undefined) {
                console.log(json.result.items[0].alias);
                rubricAlias = json.result.items[0].alias;
            }else{
                console.log('trying getRubricAlias');
                getRubricAlias(json.result.items[0].parent_id);
            }
        }
    });

    return rubricAlias;
}


//******************************************************
function Wme2Gis_InitConfig()
{
    if (wme2GIS_debug) console.log("Wme2Gis_InitConfig(): "+document.getElementById(CreateID()));

    if(!document.getElementById(CreateID()))
    {
        var srsCtrl = document.createElement('section');
        srsCtrl.id = CreateID();

        var userTabs = document.getElementById('user-info');
        if (typeof userTabs !== "undefined")
        {
            var navTabs = document.getElementsByClassName('nav-tabs', userTabs)[0];
            if (typeof navTabs !== "undefined")
            {
                var tabContent = document.getElementsByClassName('tab-content', userTabs)[0];
                if (typeof tabContent !== "undefined")
                {
                    newtab = document.createElement('li');
                    // fa ==> http://fontawesome.io/cheatsheet/
                    newtab.innerHTML = '<a href="#' + CreateID() + '" id="pwme2gis" data-toggle="tab"><span class="fa fa-map-marker"></span>&nbsp;2gis</a>';

                    navTabs.appendChild(newtab);

                    //srsCtrl.id = "sidepanel-???";
                    srsCtrl.className = "tab-pane";

                    var padding="padding:5px 9px";

                    // ------------------------------------------------------------
                    var srsCtrlinnerHTML = ''
                        +'<div class="side-panel-section">'
                        +'<h4>WME getting info from 2GIS <sup>' + WME_2gis_version + '</sup>&nbsp;<sub><a href="https://greasyfork.org/ru/scripts/19633-wme-getting-info-from-2gis" title="Link" target="_blank"><span class="fa fa-external-link"></span></a></sub></h4>'
                        +'<form class="attributes-form side-panel-section">'
/*
                        +'<div class="form-group">'
                        +'<label class="control-label">Категории:</label>'
                        +'<div class="controls">'
                        +'<textarea id="wme2gis_cfg_categories" style="width:100%;height:200px;font-size:8pt" wrap="off"></textarea>'
                        +'<small>Сопоставление: 2gis=WME, каждая пара в отдельной строке.</small>'
                        +'</div>'
                        +'</div>'
*/
                        +'<div class="form-group">'
                        +'<div class="controls">'
                        +'<label class="control-label" title="В какую позицию ставить новый POI">Расстановка</label>'
                        +'<div class="controls">'
                        +'<select class="form-control" data-type="numeric" id="wme2gis_cfg_NavigationPoint"><option value="0">Точка входа</option><option value="1">В точке клика</option><option value="2">В пределах родителя</option><option value="3">Точка 2gis</option></select>'
                        +'</div>'
                        +'<label class="control-label" title="Формат номера дома">Формат номера дома</label>'
                        +'<div class="controls">'
                        +'<select class="form-control" data-type="numeric" id="wme2gis_cfg_HNFormat"><option value="0">2GIS (2а, 2ак1, 2Б)</option><option value="1">Yandex (2А, 2Ак1, 2Б)</option><option value="2">BY (2А, 2А/1, 2Б)</option></select>'
                        +'</div>'
                        +'<div class="controls">'
                        +'<label class="control-label" title="В пределах скольки метров ставить новый POI относительно настройки Расстановка">Радиус (м):</label>'
                        +'<input name="wme2gis_cfg_radius" class="form-control" autocomplete="off" value="" id="wme2gis_cfg_radius" type="text" size="13">'
                        +'</div>'
                        +'</div>'
                        +'</div>'

                        +'<div class="form-group">'
                        +'<div class="controls">'
                        +'<label class="control-label">Категория по умолчанию</label>'
                        +'<div class="controls">'
                        +'<select class="form-control" id="wme2gis_cfg_defcategory">'
                        +'';

                        for(var i in I18n.translations[I18n.locale].venues.categories)
                        {
                            srsCtrlinnerHTML += '<option value="'+i+'">'+I18n.translations[I18n.locale].venues.categories[i]+'</option>';
                        }

                    srsCtrlinnerHTML += ''
                        +'</select>'
                        +'</div>'
                        +'</div>'
                        +'</div>'

                        +'<div class="form-group">'
                        +'<div class="controls">'
                        +'<label class="control-label" title="Уровень блокировки новых POI">Блокировка</label>'
                        +'<div class="controls">'
                        +'<select class="form-control" data-type="numeric" id="wme2gis_cfg_UserRank"><option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option><option value="4">5</option></select>'
                        +'</div>'
                        +'</div>'
                        +'</div>'

                        +'<div class="form-group">'
                        +'<div class="controls">'
                        +'<label class="control-label" title="Какие карты показывать">Показать карты</label>'
                        +'<div class="controls">'
                        +'<input name="wme2gis_cfg_2gismap" value="" id="wme2gis_cfg_2gismap" type="checkbox"><label for="wme2gis_cfg_2gismap" title="Показывать карту 2gis">&nbsp;Карта 2GIS</label><br/>'
                        +'</div>'
                        +'<div class="controls">'
                        +'<input name="wme2gis_cfg_yamap" value="" id="wme2gis_cfg_yamap" type="checkbox"><label for="wme2gis_cfg_yamap" title="Показывать карту Yandex">&nbsp;Карта Yandex</label><br/>'
                        +'</div>'
                        +'<div class="controls">'
                        +'<input name="wme2gis_cfg_osmmap" value="" id="wme2gis_cfg_osmmap" type="checkbox"><label for="wme2gis_cfg_osmmap" title="Показывать карту OSM">&nbsp;Карта OSM</label><br/>'
                        +'</div>'
                        +'</div>'
                        +'</div>'

                        +'<div class="controls">'
                        +'<label class="control-label">Дополнительные настройки</label>'
                        +'<div class="controls">'
                        +'<input name="wme2gis_cfg_addaddress" value="" id="wme2gis_cfg_addaddress" type="checkbox"><label for="wme2gis_cfg_addaddress" title="Для вновь созданной точки в поле Описание добавлять адрес.">&nbsp;Добавить адрес в описание</label><br/>'
                        +'</div>'
                        +'<div class="controls">'
                        +'<input name="wme2gis_cfg_dontselect" value="" id="wme2gis_cfg_dontselect" type="checkbox"><label for="wme2gis_cfg_dontselect" title="Не переключаться на новое POI.">&nbsp;Не выделять новое POI</label><br/>'
                        +'</div>'
                        +'<div class="controls">'
                        +'<input name="wme2gis_cfg_changecat" value="" id="wme2gis_cfg_changecat" type="checkbox"><label for="wme2gis_cfg_changecat" title="Изменять категорию POI на категорию по умолчанию при модификации свойств POI">&nbsp;Изменять категорию</label><br/>'
                        +'</div>'
                        +'<div class="controls">'
                        +'<input name="wme2gis_cfg_debug" value="" id="wme2gis_cfg_debug" type="checkbox"><label for="wme2gis_cfg_debug" title="Включить логирование">&nbsp;Debug script</label><br/>'
                        +'</div>'
                        +'</div>'

                        +'</form>'
                        +'</div>'
                        '';
                    // ------------------------------------------------------------
                    srsCtrl.innerHTML=srsCtrlinnerHTML;
                    tabContent.appendChild(srsCtrl);
                }
                else
                    srsCtrl.id='';
            }
            else
                srsCtrl.id='';
        }
        else
            srsCtrl.id='';

        if(srsCtrl.id != '')
        {
            document.getElementById("wme2gis_cfg_debug").checked = wme2GIS_debug;
            document.getElementById("wme2gis_cfg_debug").onclick = function(){wme2GIS_debug=this.checked;localStorage.setItem("wme2GIS_debug",wme2GIS_debug?"1":"0");};

            document.getElementById("wme2gis_cfg_osmmap").checked = wme2GIS_osmmap;
            document.getElementById("wme2gis_cfg_osmmap").onclick = function(){wme2GIS_osmmap=this.checked;localStorage.setItem("wme2GIS_osmmap",wme2GIS_osmmap?"1":"0");};

            document.getElementById("wme2gis_cfg_yamap").checked = wme2GIS_yamap;
            document.getElementById("wme2gis_cfg_yamap").onclick = function(){wme2GIS_yamap=this.checked;localStorage.setItem("wme2GIS_yamap",wme2GIS_yamap?"1":"0");if(wme2GIS_yamap) wme_2gis_init_script('ymap');};

            document.getElementById("wme2gis_cfg_2gismap").checked = wme2GIS_2gismap;
            document.getElementById("wme2gis_cfg_2gismap").onclick = function(){wme2GIS_2gismap=this.checked;localStorage.setItem("wme2GIS_2gismap",wme2GIS_2gismap?"1":"0");if(wme2GIS_2gismap) wme_2gis_init_script('2gis');};

            document.getElementById("wme2gis_cfg_addaddress").checked = wme2GIS_AddAddress;
            document.getElementById("wme2gis_cfg_addaddress").onclick = function(){wme2GIS_AddAddress=this.checked;localStorage.setItem("wme2GIS_AddAddress",wme2GIS_AddAddress?"1":"0");};

            document.getElementById("wme2gis_cfg_dontselect").checked = wme2GIS_dontselect;
            document.getElementById("wme2gis_cfg_dontselect").onclick = function(){wme2GIS_dontselect=this.checked;localStorage.setItem("wme2GIS_dontselect",wme2GIS_dontselect?"1":"0");};

            document.getElementById("wme2gis_cfg_changecat").checked = wme2GIS_changecat;
            document.getElementById("wme2gis_cfg_changecat").onclick = function(){wme2GIS_changecat=this.checked;localStorage.setItem("wme2GIS_changecat",wme2GIS_changecat?"1":"0");};

            document.getElementById("wme2gis_cfg_UserRank").selectedIndex = wme2GIS_UserRank;
            document.getElementById("wme2gis_cfg_UserRank").onchange = function(){wme2GIS_UserRank=this.value;localStorage.setItem("wme2GIS_UserRank",wme2GIS_UserRank);};

            document.getElementById("wme2gis_cfg_radius").value = wme2GIS_radius;
            document.getElementById("wme2gis_cfg_radius").onchange = function(){wme2GIS_radius=parseInt(this.value);localStorage.setItem("wme2GIS_radius",wme2GIS_radius);};

            // категории для выбора умолчания сортируем по названию
            function sortSelect(selElem, checkElem)
            {
                var tmpAry = new Array();
                for (var i=0;i<selElem.options.length;i++) {
                    tmpAry[i] = new Array();
                    tmpAry[i][0] = selElem.options[i].text;
                    tmpAry[i][1] = selElem.options[i].value;
                }
                tmpAry.sort();
                while (selElem.options.length > 0) {
                    selElem.options[0] = null;
                }
                for (var i=0;i<tmpAry.length;i++) {
                    var op = new Option(tmpAry[i][0], tmpAry[i][1]);
                    selElem.options[i] = op;
                    if(tmpAry[i][1] === checkElem)
                    {
                        selElem.options[i].selected=true;
                    }
                }
            }
            sortSelect(document.getElementById("wme2gis_cfg_defcategory"),wme2GIS_DefCategory);
            document.getElementById("wme2gis_cfg_defcategory").onchange = function(){wme2GIS_DefCategory=this.value;localStorage.setItem("wme2GIS_DefCategory",wme2GIS_DefCategory);};


            document.getElementById("wme2gis_cfg_NavigationPoint").selectedIndex = wme2GIS_NavigationPoint;
            document.getElementById("wme2gis_cfg_NavigationPoint").onchange = function(){wme2GIS_NavigationPoint=parseInt(this.value);console.log('wme2gis_cfg_NavigationPoint='+this.value);localStorage.setItem("wme2GIS_NavigationPoint",wme2GIS_NavigationPoint);};

            document.getElementById("wme2gis_cfg_HNFormat").selectedIndex = wme2GIS_HNFormat;
            document.getElementById("wme2gis_cfg_HNFormat").onchange = function(){wme2GIS_HNFormat=parseInt(this.value);console.log('wme2gis_cfg_HNFormat='+this.value);localStorage.setItem("wme2GIS_HNFormat",wme2GIS_HNFormat);};
            // формируем сопоставления 2гис=ВМЕ
            /*
            cat='';
            for(var i in wme2Gis_categories)
            {
                if(cat.length > 0)
                    cat+='\n';
                cat+= i+"="+wme2Gis_categories[i];
            }
            document.getElementById("wme2gis_cfg_categories").value=cat;
            document.getElementById("wme2gis_cfg_categories").onchange = function(){
                var a1=this.value.split('\n');
                var cfg={};
                for(var i=0; i < a1.length; ++i)
                {
                    var a2=a1[i].split('=');
                    cfg[a2[0]]=a2[1];
                }
                localStorage.setItem('wme2GIS_Categories', JSON.stringify(cfg));
                for(var i in wme2Gis_categories)    { delete wme2Gis_categories[i]; }
                wme2Gis_categories = cloneConfig(cfg);
            };
            */
        }

    }
    else
        if (wme2GIS_debug) console.log("Wme2Gis_InitConfig(): found '"+CreateID()+"'");
}

//******************************************************
function WMEGetInfo2Gis_HandCreatePOI()
{
    if ((typeof arguments[0]) === "object")
    {
        if ((typeof (arguments[0].poiType)) === "string")
        {
            if (arguments[0].poiType === "parking")
                $('.toolbar-group-venues').find('.dropdown-menu').find('.WazeControlDrawFeature').eq(arguments[0].poiCat).click();
            else
                $('.toolbar-group-venues').find('.dropdown-menu').find('.drawing-controls').eq(arguments[0].poiCat).find(arguments[0].poiType).click();
        }
    }
}

function wme_2gis_initBindPoi() {
    if (wme2GIS_debug) console.log("wme_2gis_initBindPoi()");
    var Config =[
        {handler: 'WMEGetInfo2Gis_Point',  title: "Создать точку (другое)",    func: WMEGetInfo2Gis_HandCreatePOI, key:-1, arg:{poiType:'.point',poiCat:6}},
        {handler: 'WMEGetInfo2Gis_Area',   title: "Создать лэндмарк (другое)", func: WMEGetInfo2Gis_HandCreatePOI, key:-1, arg:{poiType:'.polygon',poiCat:6}},
        {handler: 'WMEGetInfo2Gis_AreaNat',title: "Создать лэндмарк (природа)",func: WMEGetInfo2Gis_HandCreatePOI, key:-1, arg:{poiType:'.polygon',poiCat:9}},
        {handler: 'WMEGetInfo2Gis_Parking',title: "Создать парковку",          func: WMEGetInfo2Gis_HandCreatePOI, key:-1, arg:{poiType:'parking',poiCat:10}},
    ];
    for(var i=0; i < Config.length; ++i)
    {
        WMEKSRegisterKeyboardShortcut('WME-getting-info-from-2GIS', 'WME-getting-info-from-2GIS', Config[i].handler, Config[i].title, Config[i].func, Config[i].key, Config[i].arg);
    }

    WMEKSLoadKeyboardShortcuts('WME-getting-info-from-2GIS');

    window.addEventListener("beforeunload", function() {
        WMEKSSaveKeyboardShortcuts('WME-getting-info-from-2GIS');
    }, false);

}


// подгрузка скриптов
function wme_2gis_init_script(t)
{
     if (wme2GIS_debug) console.log("wme_2gis_init_script("+t+")");
    switch(t)
    {
        case '2gis':
        {
            if (!document.getElementById('wme2GIS_2gismap'))
            {
                // 1. создаём контейнер с ID
                var script2gisDiv= document.createElement('div');
                script2gisDiv.id = "wme2GIS_2gismap";
                script2gisDiv.setAttribute('style','display:none;');
                document.getElementsByTagName('body')[0].appendChild(script2gisDiv);

                // 2. ...в него сюём скрипт
                var script2gis   = document.createElement('script');
                script2gis.type  = "text/javascript";
                script2gis.src   = "https://maps.api.2gis.ru/2.0/loader.js?pkg=basic";
                document.getElementById('wme2GIS_2gismap').appendChild(script2gis);
            }
            break;
        }
        case 'ymap':
        {
            if (!document.getElementById('wme2GIS_yamap'))
            {
                var scriptyamapDiv= document.createElement('div');
                scriptyamapDiv.id = "wme2GIS_yamap";
                scriptyamapDiv.setAttribute('style','display:none;');
                document.getElementsByTagName('body')[0].appendChild(scriptyamapDiv);

                var scriptyamap   = document.createElement('script');
                scriptyamap.type  = "text/javascript";
                scriptyamap.src   = "https://api-maps.yandex.ru/2.1/?lang=ru_RU";
                document.getElementById('wme2GIS_yamap').appendChild(scriptyamap);
            }
            break;
        }

        //....
    }
}

//******************************************************
function wme_2gis_init() {
     if (wme2GIS_debug) console.log("wme_2gis_init()");

    wme2GIS_debug = __GetLocalStorageItem("wme2GIS_debug",'bool',false);

    wme2GIS_osmmap = __GetLocalStorageItem("wme2GIS_osmmap",'bool',false);

    wme2GIS_yamap = __GetLocalStorageItem("wme2GIS_yamap",'bool',false);

    wme2GIS_2gismap = __GetLocalStorageItem("wme2GIS_2gismap",'bool',false);

    if(wme2GIS_2gismap) // потом подгрузим, если что, из настроек
        wme_2gis_init_script('2gis');

    if(wme2GIS_yamap) // потом подгрузим, если что, из настроек
        wme_2gis_init_script('ymap');

    var scriptMy   = document.createElement('script');
    scriptMy.type  = "text/javascript";
    scriptMy.src   = "https://dl.dropboxusercontent.com/s/b3of71w3szueo95/additional-vars.js";
    document.getElementsByTagName('head')[0].appendChild(scriptMy);

    setTimeout(wme_2gis, 500);
}

function __GetLocalStorageItem(Name,Type,Def,Arr)
{
     //if (wme2GIS_debug) console.log("__GetLocalStorageItem(): Name="+Name+",Type="+Type+",Def="+Def+",Arr="+Arr);

    var tmp0=localStorage.getItem(Name);
    if (tmp0)
    {
        switch(Type)
        {
            case 'bool':
                tmp0=(tmp0 === "true" || tmp0 === "1")?true:false;
                break;
            case 'int':
                tmp0=!isNaN(parseInt(tmp0))?parseInt(tmp0):0;
                break;
            case 'arr':
                if (tmp0.length > 0)
                    if(!Arr[tmp0])
                        tmp0=Def;
                break;
        }
    }
    else
        tmp0=Def;
    return tmp0;
}

wme_2gis_init();

/**
 * @license
 * Fuse - Lightweight fuzzy-search
 *
 * Copyright (c) 2012-2016 Kirollos Risk <kirollos@gmail.com>.
 * All Rights Reserved. Apache Software License 2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
!function(t){"use strict";function e(){console.log.apply(console,arguments)}function s(t,e){var s,n,r,i;for(this.list=t,this.options=e=e||{},s=0,i=["sort","shouldSort","verbose","tokenize"],n=i.length;n>s;s++)r=i[s],this.options[r]=r in e?e[r]:h[r];for(s=0,i=["searchFn","sortFn","keys","getFn","include"],n=i.length;n>s;s++)r=i[s],this.options[r]=e[r]||h[r]}function n(t,e,s){var i,o,h,a,p,c;if(e){if(h=e.indexOf("."),-1!==h?(i=e.slice(0,h),o=e.slice(h+1)):i=e,a=t[i],null!==a&&void 0!==a)if(o||"string"!=typeof a&&"number"!=typeof a)if(r(a))for(p=0,c=a.length;c>p;p++)n(a[p],o,s);else o&&n(a,o,s);else s.push(a)}else s.push(t);return s}function r(t){return"[object Array]"===Object.prototype.toString.call(t)}function i(t,e){e=e||{},this.options=e,this.options.location=e.location||i.defaultOptions.location,this.options.distance="distance"in e?e.distance:i.defaultOptions.distance,this.options.threshold="threshold"in e?e.threshold:i.defaultOptions.threshold,this.options.maxPatternLength=e.maxPatternLength||i.defaultOptions.maxPatternLength,this.pattern=e.caseSensitive?t:t.toLowerCase(),this.patternLen=t.length,this.patternLen<=this.options.maxPatternLength&&(this.matchmask=1<<this.patternLen-1,this.patternAlphabet=this._calculatePatternAlphabet())}var o=/ +/g,h={id:null,caseSensitive:!1,include:[],shouldSort:!0,searchFn:i,sortFn:function(t,e){return t.score-e.score},getFn:n,keys:[],verbose:!1,tokenize:!1};s.VERSION="2.0.1",s.prototype.set=function(t){return this.list=t,t},s.prototype.search=function(t){this.options.verbose&&e("=====================\n","Search term:",t),this.pattern=t,this.results=[],this.resultMap={},this._prepareSearchers(),this._startSearch(),this._computeScore(),this._sort();var s=this._format();return s},s.prototype._prepareSearchers=function(){var t=this.options,e=this.pattern,s=t.searchFn,n=e.split(o),r=0,i=n.length;if(this.options.tokenize)for(this.tokenSearchers=[];i>r;r++)this.tokenSearchers.push(new s(n[r],t));this.fullSeacher=new s(e,t)},s.prototype._startSearch=function(){var t,e,s=this.options,n=s.getFn,r=this.list,i=r.length,o=this.options.keys,h=o.length,a=null;if("string"==typeof r[0])for(t=0;i>t;t++)this._analyze(r[t],t,t);else for(t=0;i>t;t++)for(a=r[t],e=0;h>e;e++)this._analyze(n(a,o[e],[]),a,t)},s.prototype._analyze=function(t,s,n){var i,h,a,p,c,l,u,f,d,g,v,m,S,y,b,_=this.options,L=!1;if(void 0!==t&&null!==t)if(h=[],"string"==typeof t){if(i=t.split(o),_.verbose&&e("---------\n","Record:",i),this.options.tokenize){for(a=this.tokenSearchers,p=a.length,y=0;y<this.tokenSearchers.length;y++){for(g=this.tokenSearchers[y],v=[],b=0;b<i.length;b++)m=i[b],S=g.search(m),S.isMatch?(L=!0,v.push(S.score),h.push(S.score)):(v.push(1),h.push(1));_.verbose&&e('Score for "'+g.pattern+'":',v)}for(l=h[0],f=h.length,y=1;f>y;y++)l+=h[y];l/=f,_.verbose&&e("Individual word score average:",l)}d=this.fullSeacher.search(t),_.verbose&&e("Full text score:",d.score),u=d.score,void 0!==l&&(u=(u+l)/2),_.verbose&&e("Average",u),(L||d.isMatch)&&(c=this.resultMap[n],c?c.scores.push(u):(this.resultMap[n]={item:s,scores:[u]},this.results.push(this.resultMap[n])))}else if(r(t))for(y=0;y<t.length;y++)this._analyze(t[y],s,n)},s.prototype._computeScore=function(){var t,e,s,n,r,i=this.results;for(t=0;t<i.length;t++){for(s=0,n=i[t].scores,r=n.length,e=0;r>e;e++)s+=n[e];i[t].score=s/r}},s.prototype._sort=function(){var t=this.options;t.shouldSort&&(t.verbose&&e("Sorting...."),this.results.sort(t.sortFn))},s.prototype._format=function(){var t,s,n,r,i,o=this.options,h=o.getFn,a=[],p=this.results;for(o.verbose&&e("------------\n","Output:\n",p),r=o.id?function(t){p[t].item=h(p[t].item,o.id,[])[0]}:function(){},i=function(t){var e,s,n;if(o.include.length>0)for(e={item:p[t].item},n=0;n<o.include.length;n++)s=o.include[n],e[s]=p[t][s];else e=p[t].item;return e},s=0,n=p.length;n>s;s++)r(s),t=i(s),a.push(t);return a},i.defaultOptions={location:0,distance:100,threshold:.6,maxPatternLength:32},i.prototype._calculatePatternAlphabet=function(){var t={},e=0;for(e=0;e<this.patternLen;e++)t[this.pattern.charAt(e)]=0;for(e=0;e<this.patternLen;e++)t[this.pattern.charAt(e)]|=1<<this.pattern.length-e-1;return t},i.prototype._bitapScore=function(t,e){var s=t/this.patternLen,n=Math.abs(this.options.location-e);return this.options.distance?s+n/this.options.distance:n?1:s},i.prototype.search=function(t){var e,s,n,r,i,h,a,p,c,l,u,f,d,g,v,m,S,y,b=this.options;if(t=b.caseSensitive?t:t.toLowerCase(),this.pattern===t)return{isMatch:!0,score:0};if(this.patternLen>b.maxPatternLength)return S=t.match(new RegExp(this.pattern.replace(o,"|"))),y=!!S,{isMatch:y,score:y?.5:1};for(r=b.location,n=t.length,i=b.threshold,h=t.indexOf(this.pattern,r),-1!=h&&(i=Math.min(this._bitapScore(0,h),i),h=t.lastIndexOf(this.pattern,r+this.patternLen),-1!=h&&(i=Math.min(this._bitapScore(0,h),i))),h=-1,v=1,m=[],c=this.patternLen+n,e=0;e<this.patternLen;e++){for(a=0,p=c;p>a;)this._bitapScore(e,r+p)<=i?a=p:c=p,p=Math.floor((c-a)/2+a);for(c=p,l=Math.max(1,r-p+1),u=Math.min(r+p,n)+this.patternLen,f=Array(u+2),f[u+1]=(1<<e)-1,s=u;s>=l;s--)if(g=this.patternAlphabet[t.charAt(s-1)],0===e?f[s]=(f[s+1]<<1|1)&g:f[s]=(f[s+1]<<1|1)&g|((d[s+1]|d[s])<<1|1)|d[s+1],f[s]&this.matchmask&&(v=this._bitapScore(e,s-1),i>=v)){if(i=v,h=s-1,m.push(h),!(h>r))break;l=Math.max(1,2*r-h)}if(this._bitapScore(e+1,r)>i)break;d=f}return{isMatch:h>=0,score:0===v?.001:v}},"object"==typeof exports?module.exports=s:"function"==typeof define&&define.amd?define(function(){return s}):t.Fuse=s}(this);

// from: https://greasyfork.org/en/users/5920-rickzabel
/*
when adding shortcuts each shortcut will need a uniuque name
the command to add links is WMERegisterKeyboardShortcut(ScriptName, ShortcutsHeader, NewShortcut, ShortcutDescription, FunctionToCall, ShortcutKeysObj) {
    ScriptName: This is the name of your script used to track all of your shortcuts on load and save.
    ScriptName: replace 'WMEAwesome' with your scripts name such as 'SomeOtherScript'
    ShortcutsHeader: this is the header that will show up in the keyboard editor
    NewShortcut: This is the name of the shortcut and needs to be uniuque from all of the other shortcuts, from other scripts, and WME
    ShortcutDescription: This wil show up as the text next to your shortcut
    FunctionToCall: this is the name of your function that will be called when the keyboard shortcut is presses
    ShortcutKeysObj: the is the object representing the keys watched set this to '-1' to let the users specify their own shortcuts.
    ShortcutKeysObj: The alt, shift, and ctrl keys are A=alt, S=shift, C=ctrl. for short cut to use "alt shift ctrl and l" the object would be 'ASC+l'
*/
function WMEKSRegisterKeyboardShortcut(e,r,t,a,o,s,c){try{I18n.translations.en.keyboard_shortcuts.groups[e].members.length}catch(n){Waze.accelerators.Groups[e]=[],Waze.accelerators.Groups[e].members=[],I18n.translations.en.keyboard_shortcuts.groups[e]=[],I18n.translations.en.keyboard_shortcuts.groups[e].description=r,I18n.translations.en.keyboard_shortcuts.groups[e].members=[]}if(o&&"function"==typeof o){I18n.translations.en.keyboard_shortcuts.groups[e].members[t]=a,Waze.accelerators.addAction(t,{group:e});var l="-1",i={};i[l]=t,Waze.accelerators._registerShortcuts(i),null!==s&&(i={},i[s]=t,Waze.accelerators._registerShortcuts(i)),W.accelerators.events.register(t,null,function(){o(c)})}else alert("The function "+o+" has not been declared")}function WMEKSLoadKeyboardShortcuts(e){if(localStorage[e+"KBS"])for(var r=JSON.parse(localStorage[e+"KBS"]),t=0;t<r.length;t++)Waze.accelerators._registerShortcuts(r[t])}function WMEKSSaveKeyboardShortcuts(e){var r=[];for(var t in Waze.accelerators.Actions){var a="";if(Waze.accelerators.Actions[t].group==e){Waze.accelerators.Actions[t].shortcut?(Waze.accelerators.Actions[t].shortcut.altKey===!0&&(a+="A"),Waze.accelerators.Actions[t].shortcut.shiftKey===!0&&(a+="S"),Waze.accelerators.Actions[t].shortcut.ctrlKey===!0&&(a+="C"),""!==a&&(a+="+"),Waze.accelerators.Actions[t].shortcut.keyCode&&(a+=Waze.accelerators.Actions[t].shortcut.keyCode)):a="-1";var o={};o[a]=Waze.accelerators.Actions[t].id,r[r.length]=o}}localStorage[e+"KBS"]=JSON.stringify(r)}
/* ********************************************************** */