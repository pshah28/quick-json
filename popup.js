var index = 0;
var xhr = new XMLHttpRequest();
var jsonURL = "";
var originalUrl = "";

//overrite downloaded files with same name
chrome.downloads.onDeterminingFilename.addListener(function (item, suggest) {
	suggest({filename: 'test.json', conflictAction: 'overwrite'});
});
//update url of underlying page
chrome.downloads.onChanged.addListener(function(){
	var filePath = chrome.downloads.search({
		limit: 1,
		orderBy: ["-startTime"],
		query: ["test.json"]
	}, function(file){
		modifiedUrl = originalUrl
		if(modifiedUrl.includes('JSONDATA'))
		{
			chrome.tabs.update({url:modifiedUrl})
		} else {
			chrome.tabs.update({url:originalUrl+"?JSONDATA="+file[0].filename})
		}
	});
})

this.filePath = "";
//fetch json with ajax query
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {username:'test', password:'test'}, function(response) {
		originalUrl = tabs[0].url;
    if(originalUrl.includes("JSONDATA")) { //if json has been edited and saved, use the locally stored json data to preserve changes
      useLocalJSON();
    }
    else{ //else make a request to retrieve the json of the page
			url = new URL(originalUrl);
			url = url.origin + url.pathname
      if(url.includes(".html")) {
        jsonURL = url.replace(".html", ".json");
      }
      else if (url.split("/").pop() != "") {
        jsonURL = url + ".json";
      }
      else {
        jsonURL = url + "/index.json";
      }
    data = {username:"test", password:"test"}
    $.ajax({
      dataType: 'json',
      url: jsonURL,
      data: data,
			username:"test",
			password:"test",
      success: function(data) {
        json = JSON.parse(JSON.stringify(data));
        window.editedJSON = json;
        traverse(json, document.getElementById('json'));
      }
    });
    }
  })
});

function useLocalJSON() {
  chrome.storage.local.get("json", function(items) {
    if (!chrome.runtime.error) {
      window.editedJSON = items["json"];
      traverse(window.editedJSON, document.getElementById('json'));
      return;
      }
    });
}

document.getElementById('filter').addEventListener("keydown",function search(e) { //filtering function
    if(e.keyCode == 13) {
				window.find(this.value)[index];
        index++;
    }
    if(e.keyCode == 8) {
        index = 0;
    }
});

//constructing a nested ul given a json object
function traverse(obj, el) {
  for(k in obj) {
    if(k=="custom") continue;
    if(obj[k] !== null && typeof(obj[k])=="object" && Object.keys(obj[k]).length !== 0) {
			//set innerText of nodes
      node = document.createElement("ul");
      node.innerText = k + ":";
      node.setAttribute('key', k);
      el.append(node);
      traverse(obj[k], node);
    } else {
      node = document.createElement("li");      //if current obj at index is a string instead of object, append an li with string's content
      key = document.createElement("span");      //if current obj at index is a string instead of object, append an li with string's content
      value = document.createElement("span");      //if current obj at index is a string instead of object, append an li with string's content

      key.innerText = k + ": ";
			key.classList.add("key");
      value.classList.add("json-" + typeof(obj[k]))
			value.classList.add("value")
      value.setAttribute("type", typeof(obj[k]))
			value.innerText = obj[k];

      node.setAttribute("key", k);
      node.setAttribute("value", obj[k]);

      node.append(key);
			node.append(value);
      el.append(node);
    }
  }
}


document.addEventListener('click', addInput);    //add input box on click
document.getElementById("saveButton").addEventListener("click", function(e){ //save button
	chrome.downloads.setShelfEnabled(false)
	save(window.editedJSON,"test.json");
	chrome.downloads.setShelfEnabled(false)
});

document.addEventListener('mouseover', function(e){    //for path on hover
  e = e || window.event;
  var el = e.target || e.srcElement;
  path = getPath(el);
  document.getElementById("path").innerText = path.join(".");

})

//get json path given a dom node
function getPath(el) {
  path = [];
  while(el.parentNode && el.id !== "json") {  //traverse up tree until we get to root ul
    path.unshift(el.getAttribute("key"));
    el = el.parentNode;
  }
  return path;
}

function addInput(e){      //add input box on click
	if(e.target.nodeName == "SPAN" || e.target.nodeName == "LI") {
	  e = e || window.event;
	  var target = e.target || e.srcElement;
		type = "object"
		if(target.nodeName == "SPAN") {
			type = target.getAttribute("type");
			target = target.parentNode;
		}
	  if(target.nodeName == "LI")
	  {
	    text = target.getAttribute("value");
	    input = document.createElement("input");
	    input.value = text;

      button = document.createElement("button");
      button.innerHTML = "EDIT";
      button.addEventListener("click", (evt) => {
        editJSON(evt, type);
      });

      deleteButton = document.createElement("button");
	    deleteButton.innerHTML = "DELETE";
	    deleteButton.addEventListener("click", (evt) => {
				editJSON(evt, "delete");
			});

      target.append(input);
	    target.append(button);
      target.append(deleteButton)
	  }
	}
}


function editJSON (evt, type) {     //set value of html dom element and then also modify underlying json
  el = evt.target.parentNode;
  val = evt.target.previousSibling.value;
  el.setAttribute("value",val);
  el.innerText = el.getAttribute("key") + ": " + val;
	el.classList.add("modified");
  path = getPath(el);
	console.log(path)
  window.editedJSON = setNode(path, window.editedJSON, val, type) //modify json given path of node
  chrome.storage.local.set({"json":window.editedJSON})
}

function setNode(path, json, val, type) {
  jsonCopy = json;
  for(i=0;i<path.length ; i++){
    if(parseInt(path[i])<100){      //this is in order to prevent keys that are meant to be ints but are actually strings
      path[i] = JSON.parse(path[i]);
    }
    if(i==path.length-1){         //on last part of path, set the value
			if(type=="string" || type=="object") {
				if(val == "null") val = null;
				jsonCopy[path[i]] = val;
			} else if(type=="number") {
				jsonCopy[path[i]] = JSON.parse(val);
			} else if(type=="boolean") {
        jsonCopy[path[i]] = JSON.parse(val);
      } else if(type=="delete") {
				delete jsonCopy[path[i]]
      } else {
				jsonCopy[path[i]] = JSON.parse(val);
			}
    }
    jsonCopy = jsonCopy[path[i]];
  }
  return json;
}

function save(data, filename){        //save function from online
	if(!data) {
      console.error('Console.save: No data')
      return;
  }

  if(!filename) filename = 'console.json'

  if(typeof data === "object"){
      data = JSON.stringify(data, undefined, 4)
  }

  var blob = new Blob([data], {type: 'text/json'})

	chrome.downloads.download({url: window.URL.createObjectURL(blob), filename:filename})
 }
