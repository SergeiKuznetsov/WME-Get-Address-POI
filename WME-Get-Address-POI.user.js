// ==UserScript==
// @name         WME Get Address POI
// @namespace    https://github.com/WazeRus/WME-Get-Address-POI
// @version      0.1.6.12
// @description  Information from 2gis in landmark edit panel
// @author       coilamo & skirda & Griev0us
// @include             https://*.waze.com/editor/*
// @include             https://*.waze.com/*/editor/*
// @include             https://*.waze.com/map-editor/*
// @include             https://*.waze.com/beta_editor/*
// @grant        none
// Спасибо skirda за помощь в улучшении скрипта
// ==/UserScript==

var WME_2gis_version = '0.1.6.12';

function wme_2gis() {
    console.log('Starting wme_2gis');
    if (typeof Waze === "undefined")
	{
		setTimeout(wme_2gis,500);
		return;
	}
	if (typeof Waze.selectionManager === "undefined")
	{
		setTimeout(wme_2gis,500);
		return;
	}
	if (typeof Waze.model === "undefined")
	{
		setTimeout(wme_2gis,500);
		return;
	}

	try {
		Waze.selectionManager.events.register("selectionchanged", null, wme_2gis_InserHTML);
	}
	catch (err) {
        console.log('wme_2gis error');
	}
}


function wme_2gis_InserHTML() {

    if (Waze.selectionManager.selectedItems.length > 0 && Waze.selectionManager.selectedItems[0].model.type === "venue") {
        console.log('wme_2gis_InserHTML');

        $('#landmark-edit-general').prepend(
            '<div class="form-group"> \
                 <label class="control-label">External POI (version ' + WME_2gis_version + ')</label> \
                     <div class="controls"> \
                         <div id="2gis"></div><div id="gm"></div><div id="ym"></div><div id="osm"></div> \
                     </div> \
                 </div> \
             </div>'
        );
        var div2gis = document.getElementById('2gis');
        var divGm = document.getElementById('gm');
        var divYm = document.getElementById('ym');
        var divOsm = document.getElementById('osm');

        //getting lon/lat selected point
        var poi_id=Waze.selectionManager.selectedItems[0].model.attributes.id;
        console.log(Waze.model.venues.get(poi_id).geometry);
        var x,y;
        if(Waze.model.venues.get(poi_id).geometry.x !== undefined && Waze.model.venues.get(poi_id).geometry.y !== undefined) {
            x = Waze.model.venues.get(poi_id).geometry.x;
            y = Waze.model.venues.get(poi_id).geometry.y;
        }else{
            x = (Waze.model.venues.get(poi_id).geometry.bounds.left + Waze.model.venues.get(poi_id).geometry.bounds.right) / 2;
            y = (Waze.model.venues.get(poi_id).geometry.bounds.top + Waze.model.venues.get(poi_id).geometry.bounds.bottom) / 2;
        }
        var poiPos=new OpenLayers.LonLat(x,y);
        poiPos.transform(new OpenLayers.Projection("EPSG:900913"),new OpenLayers.Projection("EPSG:4326"));
        console.log(poiPos.lat, poiPos.lon);

        //2GIS
        var url = 'https://catalog.api.2gis.ru/2.0/geo/search';
        var data = {
            "point": poiPos.lon + ',' + poiPos.lat,
            "format": "json",
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
                var script2   = document.createElement('script');
                script2.type  = "text/javascript";
                var s = document.getElementsByTagName('head')[0].appendChild(script2);
                s.innerHTML='var map; DG.then(function () {map = DG.map(\'map_2gis\', {center: [' + poiPos.lat + ',' + poiPos.lon + '],zoom: 17,fullscreenControl: false,zoomControl: false});});';
                
                div2gis.innerHTML='2GIS: ' + json.result.items[0].full_name + '<br/>' +
                '<div id="map_2gis" style="width:275px; height:275px"></div>';
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
               var gm_obj = json.results[0].address_components;
               if(gm_obj[0].long_name !== 'Unnamed Road') {
                   divGm.innerHTML='GM: <a href="#" id="gm_storeaddress" title="Заполнить адрес">'+gm_obj[0].long_name + ', ' + gm_obj[1].long_name+'</a>';
                   divGm.onclick =  __ModityAddressYM;
                   if(gm_obj[2].long_name !== null)
                       document.getElementById('gm_storeaddress').setAttribute('cityName', gm_obj[2].long_name);
                   if(gm_obj[1].long_name !== null)
                       document.getElementById('gm_storeaddress').setAttribute('streetName', gm_obj[1].long_name);
                   if(gm_obj[0].long_name !== null)
                       document.getElementById('gm_storeaddress').setAttribute('houseNumber', gm_obj[0].long_name);
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
                
                function findSomething(object, name) {
                    console.log(object);
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
                
                if(houseNumber !== undefined && houseNumber !== null) {
                    divYm.innerHTML='YM: <a href="#" id="ym_storeaddress" title="Заполнить адрес">' + houseNumber + ', ' + streetName + '</a>';
                    divYm.onclick =  __ModityAddressYM;

                    var ym_locality = findSomething(ym_obj, "LocalityName");
                    if(typeof(ym_locality.DependentLocality) !== undefined) ym_locality = ym_locality.DependentLocality;

                    if(cityName !== null)
                        document.getElementById('ym_storeaddress').setAttribute('cityName', cityName);
                    if(streetName !== null)
                        document.getElementById('ym_storeaddress').setAttribute('streetName', streetName);
                    if(houseNumber !== null)
                        document.getElementById('ym_storeaddress').setAttribute('houseNumber', houseNumber);
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
               var osm_obj = json.address;
               if(osm_obj.house_number !== undefined) {
                   divOsm.innerHTML='OSM: <a href="#" id="osm_storeaddress" title="Заполнить адрес">'+osm_obj.house_number + ', ' + osm_obj.road + '</a>';
                   divOsm.onclick =  __ModityAddressYM;
                   //document.getElementById('osm_storeaddress').setAttribute('cityName', gm_obj[2].long_name);
                   document.getElementById('osm_storeaddress').setAttribute('streetName', osm_obj.road);
                   document.getElementById('osm_storeaddress').setAttribute('houseNumber', osm_obj.house_number);
               }
           }
        });

    }
    return;
}

function __ModityAddressYM()
{
    var cityName=this.children[0].getAttribute('cityname');
    console.log(cityName);
    var streetName=this.children[0].getAttribute('streetname');
    console.log(streetName);
    var houseNumber=this.children[0].getAttribute('housenumber');
    console.log(houseNumber);
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
                console.log(Waze.model.streets.objects[i].name);
                streets.push({"name": Waze.model.streets.objects[i].name});
            }

            console.log(streets);
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
            console.log(wmeStreetName[0].name);
            
			if($('input['+GetControlName('streetname')+']').val() !== wmeStreetName[0].name) {
				
                // если чекед ("без улицы") - сделать uncheck (разлочить строку ввода)
				if ($(GetControlName('streetnamecheck'))[0].checked)
					$(GetControlName('streetnamecheck')).click();
                //если имя не пустое, сообщаем, что мы его меняем
                if($('input['+GetControlName('streetname')+']').val().length)
                    alert('Изменено название улицы. ' + $('input['+GetControlName('streetname')+']').val() + ' -> ' + wmeStreetName[0].name );;
				// ставить имя стрита в адрес
				$('input['+GetControlName('streetname')+']').val(wmeStreetName[0].name).change();
				mod=true;
			}
		}

		// ** обработка номера дома **
		if(houseNumber && houseNumber !== "")
		{
            
            // удаляем пробелы
            houseNumber=houseNumber.replace(/\s+/g, '');
			// коррекция букв в номерах домов
            if (/^\d{1,6}[а-я]$/.test(houseNumber)) houseNumber = houseNumber.toUpperCase();
            // валидация
            
            var namePOI = $('input[name="name"]');
            var houseName = (namePOI.val())?namePOI.val():"";
            namePOI.val(houseName.replace(/№\s*(\d)/, '№ $1')).change();

			// выносим номер дома в название (если пусто)
			if(namePOI.length > 1)
			{
				for(var ii=0; ii < namePOI.length; ++ii)
				{
					if (typeof ($(namePOI[ii]).attr("id")) === "undefined" && !$(namePOI[ii]).val())
					{
						$(namePOI[ii]).val(houseNumber).change();
						break;
					}
				}
			}
			else
			{
				if(!namePOI.val() || (/^\d{1,6}[а-я]$/.test(namePOI.val())))
					namePOI.val(houseNumber).change();
			}
            
            //ставим лок
            var userRank = Waze.loginManager.user.rank;
            if($('select[name="lockRank"]').val() !== userRank)
                $('select[name="lockRank"]').val(userRank).change();

			// ставить номер дома в адрес
			if(!(/^\d{1,6}[а-я]{1,}\d{1,3}$/.test(houseNumber)))
			{
				$('input['+GetControlName('housenumber')+']').val(houseNumber).change();
				mod=true;
			}

		}

		// ** обработка имени НП **
		if(cityName && cityName !== "")
		{
			if(!$('input['+GetControlName('cityname')+']').val().length)
			{
				// если чекед ("без НП") - сделать uncheck (разлочить строку ввода)
				if ($(GetControlName('citynamecheck'))[0].checked)
					$(GetControlName('citynamecheck')).click();

				// ставить имя НП в адрес
				$('input['+GetControlName('cityname')+']').val(cityName).change();
				mod=true;
			}
		}
		console.log(GetControlName('save'));
		$('button['+(mod ?GetControlName('save'):GetControlName('cancel'))+']').click();
	}, 60);

}

function wme_2gis_init() {
    console.log('wme_2gis_init');
    
    var script2gis   = document.createElement('script');
	script2gis.type  = "text/javascript";
	script2gis.src   = "https://maps.api.2gis.ru/2.0/loader.js?pkg=full";
	document.getElementsByTagName('head')[0].appendChild(script2gis);
    
    //var scriptFuse   = document.createElement('script');
	//scriptFuse.type  = "text/javascript";
	//scriptFuse.src   = "https://raw.githubusercontent.com/krisk/fuse/master/src/fuse.min.js";
	//document.getElementsByTagName('head')[0].appendChild(scriptFuse);
    
    
    setTimeout(wme_2gis, 500);
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