// ==UserScript==
// @name         Stack Exchange Timer
// @namespace    https://github.com/TheIoTCrowd/StackPostTimer
// @version      0.3.2
// @description  Timer to remind you to review Stack Exchange posts
// @author       Aurora0001
// @match        https://*.stackexchange.com/*
// @match        https://stackoverflow.com/*
// @match        https://superuser.com/*
// @match        https://serverfault.com/*
// @match        https://askubuntu.com/*
// @exclude      https://chat.stackexchange.com/*
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.18.1/moment.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/react/15.5.4/react.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/react/15.5.4/react-dom.js
// @downloadURL  https://github.com/TheIoTCrowd/StackPostTimer/raw/master/timer.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    // Apologies in advance to those reading this... it ain't gonna be pretty.
    // - Aurora0001
    GM_addStyle(`
        .topbar-icon.icon-timer {
            background: transparent !important;
            fill: #858c93;
            padding-top: 8px;
            height: 26px;
            width: 36px;
        }

        .icon-timer.timer-active {
            fill: #da670b;
        }

        #timerDialogue > div {
            position: absolute;
            top: 35px;
        }
        .items-hidden {
            display: none;
        }
        ul.js-items > li > a.dismiss-link {
            color: #333;
            padding-top: 0;
            font-size: 11px;
            display: inline;
        }

        ul.js-items > li > a.dismiss-link, ul.js-items > li > span {
            font-size: 11px;
        }

        ul.js-items > li > a.link-text {
            padding-bottom: 0;
        }

        .popup.popup-show {
            display: block;
            width: 400px;
        }

        select.time-select {
            padding-top: 8px;
            padding-bottom: 7px;
            padding-left: 10px;
            color: #3b4045;
            padding-right: 10px;
            border: 1px solid #c8ccd0;
        }

        .timer-comment-box {
            width: 95%;
        }

        .date-tooltip {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
        }
    `);


    // Create localStorage if first run
    // Schema:
    // {
    //     "timers": [
    //         { "title": "Foo", "link": "bar", "time": "unix timestamp", "comment": "none" }
    //     ]
    // }
    (function() {
        var items = localStorage.getItem("timers");
        if (items === null) {
            localStorage.setItem("timers", JSON.stringify({"timers": []}));
        }
    })();

    // localStorage utils
    // Returns { "timers": [ { title, time (unix timestamp), link, id, message } ]
    function loadTimers() {
        var items = localStorage.getItem("timers");
        return JSON.parse(items);
    }

    // title: String
    // time: unix timestamp
    // link: String
    // message: String
    // => null
    function saveTimer(title, time, link, message, id) {
        let timers = loadTimers();
        timers.timers.push({
            title: title,
            time: time,
            link: link,
            message: message,
            id: id
        });
        localStorage.setItem("timers", JSON.stringify(timers));
    }

    function removeTimer(id) {
        let timers = loadTimers();
        timers.timers = timers.timers.filter(timer => timer.id !== id);
        localStorage.setItem("timers", JSON.stringify(timers));
    }

    function main() {
        // Timer icon on topbar
        const timerIcon = document.createElement("a");
        timerIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg"><path d="M1024 544v448q0 14-9 23t-23 9h-320q-14 0-23-9t-9-23v-64q0-14 9-23t23-9h224v-352q0-14 9-23t23-9h64q14 0 23 9t9 23zm416 352q0-148-73-273t-198-198-273-73-273 73-198 198-73 273 73 273 198 198 273 73 273-73 198-198 73-273zm224 0q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z"/></svg>`;
        timerIcon.id = "timerDropdown";
        const anyTimerExpired = loadTimers().timers.filter(item => moment().isAfter(moment.unix(item.time))).length > 0;
        timerIcon.className += `topbar-icon -link icon-timer ${anyTimerExpired?'timer-active':''}`;
        timerIcon.onclick = () => {
            const dialogue = document.getElementById("timerDialogueChild");
            const boundingBoxTimer = document.getElementById("timerDropdown").getBoundingClientRect();
            const boundingBoxTopbar = (document.getElementsByClassName("topbar-wrapper")[0] || document.getElementsByClassName("-container")[0]).getBoundingClientRect();
            let left = boundingBoxTimer.left - boundingBoxTopbar.left;
            if (left + 375 > window.innerWidth) {
                left -= 375;
                left += (boundingBoxTimer.right - boundingBoxTimer.left);
            }
            if(dialogue.style.display !== "block"){ dialogue.style.display = "block";} else { dialogue.style.display = "none";}
            dialogue.style.left = left.toString() + "px";
            dialogue.style.top = boundingBoxTimer.bottom.toString() + "px";
            if(timerIcon.classList.contains("topbar-icon-on")){ timerIcon.classList.remove("topbar-icon-on");}else{timerIcon.classList.add("topbar-icon-on");}
        };
        let topbar = null;
        if (StackExchange.options.site.name === "Stack Overflow") {
            const topbarlist = document.getElementsByClassName("js-inbox-button")[0].parentNode.parentNode;
            topbar = document.createElement("li");
            topbar.classList += "-list";
            topbar.style.marginTop = "4px";
            topbarlist.appendChild(topbar);
        } else {
            topbar = document.getElementsByClassName("network-items")[0];
        }
        topbar.appendChild(timerIcon);

        // Timer dropdown dialogue
        const timerDialogue = document.createElement("div");
        timerDialogue.id = "timerDialogue";
        const corral = document.getElementsByClassName("js-topbar-dialog-corral")[0];
        corral.appendChild(timerDialogue);

        const getItems = () => loadTimers().timers;

        // Render dialogue with React
        /*
    class Group extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hidden: false, items: this.props.getItems()};
  }

  toggleHidden() {
    this.setState((prevState, props) => ({
      hidden: !prevState.hidden
    }));
  }

  render() {
    const listElements = this.state.items.sort((a, b) => {
      return moment.unix(a.time).isAfter(moment.unix(b.time));
    });
    return (
      <div className="js-date-group date-group">
        <div className="date-group-toggle-row js-date-group-toggle">
          <span className="date-header">{this.props.title}</span>
          <a className={`date-group-toggle ${this.state.hidden?"toggle-hidden":""}`} onClick={this.toggleHidden.bind(this)}></a>
        </div>
        <ul className={`js-items items ${this.state.hidden?"items-hidden":""}`}>
          {
            this.state.items.map(
             item => <Item key={item.id} title={item.title} link={item.link} time={item.time} message={item.message} id={item.id} />
          )}
        </ul>
      </div>
    );
  }
}

class Item extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hidden: false};
  }
  render() {
    const date = moment.unix(this.props.time);
    return (<li className={this.state.hidden?"items-hidden":""}>
    <a href={this.props.link} className="link-text">
      <div className="message-text">
        <h4>{this.props.title}</h4>
      </div>
    </a>
    <a className="dismiss-link" onClick={() => {removeTimer(this.props.id); this.setState({hidden: true})}}>dismiss</a>
    <span title={date.calendar()} className={`date-tooltip rep-change js-rep-change ${moment().isAfter(date)?'rep-down':'rep-up'}`}>
        {date.fromNow()}
    </span>
    <span>{this.props.message}</span>
  </li>
);
  }
}


const CreateTimerPopup = ({postId, callback}) => {
  const popupSubmit = (e) => {
    e.preventDefault();
    let timeMultiplier = 0;
    switch (e.target.elements.time.options[e.target.elements.time.selectedIndex].value) {
      case "minute":
        timeMultiplier = 60;
        break;
      case "hour":
        timeMultiplier = 3600;
        break;
      case "day":
        timeMultiplier = 3600 * 24;
        break;
    }
    const timerSeconds = e.target.elements.timeDigit.value * timeMultiplier;
    callback(timerSeconds, e.target.elements.comment.value);
  };

  return (
  <div className="popup popup-show">
    <div className="popup-close">
      <a title="close this popup (or hit Esc)" onClick={() => setTimeout(() => callback(), 50)}>×</a>
    </div>
    <div>
      <h2 className="handle">Create Timer</h2>
      <form onSubmit={popupSubmit.bind(this)}>
        Set timer for <input name="timeDigit" type="number" /> 
        <select className="time-select" name="time">
          <option value="minute">minutes</option>
          <option value="hour">hours</option>
          <option value="day">days</option>
        </select>.
        Comment: <input type="text" name="comment" className="timer-comment-box" />
        <input type="submit" value="Save Timer" />
      </form>
    </div>
  </div>
);
}

ReactDOM.render(
  <div className="topbar-dialog achievements-dialog dno" id="timerDialogueChild">
      <div className="header">Post Timers</div>
      <div className="modal-content">
          <Group title="Timers" getItems={getItems}/>
      </div>
  </div>,
  timerDialogue
);

function createTimerPopup(parent, title, postId) {
  const callback = (timerSeconds, comment) => {
    ReactDOM.unmountComponentAtNode(parent);
    if (timerSeconds !== undefined) {
      const time = moment().add(timerSeconds, 'seconds').unix();
      const link = `https://${window.location.host}/q/${postId}`;
      saveTimer(title, time, link, comment, postId);
    }
  };

  ReactDOM.render(
    <CreateTimerPopup postId={postId} callback={callback} />,
    parent
  );
}
*/
        var _createClass=function(){function c(d,f){for(var h,g=0;g<f.length;g++)h=f[g],h.enumerable=h.enumerable||!1,h.configurable=!0,"value"in h&&(h.writable=!0),Object.defineProperty(d,h.key,h)}return function(d,f,g){return f&&c(d.prototype,f),g&&c(d,g),d}}();function _classCallCheck(c,d){if(!(c instanceof d))throw new TypeError("Cannot call a class as a function")}function _possibleConstructorReturn(c,d){if(!c)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return d&&("object"==typeof d||"function"==typeof d)?d:c}function _inherits(c,d){if("function"!=typeof d&&null!==d)throw new TypeError("Super expression must either be null or a function, not "+typeof d);c.prototype=Object.create(d&&d.prototype,{constructor:{value:c,enumerable:!1,writable:!0,configurable:!0}}),d&&(Object.setPrototypeOf?Object.setPrototypeOf(c,d):c.__proto__=d)}var Group=function(c){function d(f){_classCallCheck(this,d);var g=_possibleConstructorReturn(this,(d.__proto__||Object.getPrototypeOf(d)).call(this,f));return g.state={hidden:!1,items:g.props.getItems()},g}return _inherits(d,c),_createClass(d,[{key:"toggleHidden",value:function toggleHidden(){this.setState(function(f){return{hidden:!f.hidden}})}},{key:"render",value:function render(){this.state.items.sort(function(g,h){return moment.unix(g.time).isAfter(moment.unix(h.time))});return React.createElement("div",{className:"js-date-group date-group"},React.createElement("div",{className:"date-group-toggle-row js-date-group-toggle"},React.createElement("span",{className:"date-header"},this.props.title),React.createElement("a",{className:"date-group-toggle "+(this.state.hidden?"toggle-hidden":""),onClick:this.toggleHidden.bind(this)})),React.createElement("ul",{className:"js-items items "+(this.state.hidden?"items-hidden":"")},this.state.items.map(function(g){return React.createElement(Item,{key:g.id,title:g.title,link:g.link,time:g.time,message:g.message,id:g.id})})))}}]),d}(React.Component),Item=function(c){function d(f){_classCallCheck(this,d);var g=_possibleConstructorReturn(this,(d.__proto__||Object.getPrototypeOf(d)).call(this,f));return g.state={hidden:!1},g}return _inherits(d,c),_createClass(d,[{key:"render",value:function render(){var g=this,f=moment.unix(this.props.time);return React.createElement("li",{className:this.state.hidden?"items-hidden":""},React.createElement("a",{href:this.props.link,className:"link-text"},React.createElement("div",{className:"message-text"},React.createElement("h4",null,this.props.title))),React.createElement("a",{className:"dismiss-link",onClick:function onClick(){removeTimer(g.props.id),g.setState({hidden:!0})}},"dismiss"),React.createElement("span",{title:f.calendar(),className:"date-tooltip rep-change js-rep-change "+(moment().isAfter(f)?"rep-down":"rep-up")},f.fromNow()),React.createElement("span",null,this.props.message))}}]),d}(React.Component),CreateTimerPopup=function(_ref){var c=_ref.postId,d=_ref.callback;return React.createElement("div",{className:"popup popup-show"},React.createElement("div",{className:"popup-close"},React.createElement("a",{title:"close this popup (or hit Esc)",onClick:function onClick(){return setTimeout(function(){return d()},50)}},"\xD7")),React.createElement("div",null,React.createElement("h2",{className:"handle"},"Create Timer"),React.createElement("form",{onSubmit:function f(g){g.preventDefault();var h=0;switch(g.target.elements.time.options[g.target.elements.time.selectedIndex].value){case"minute":h=60;break;case"hour":h=3600;break;case"day":h=86400;}var j=g.target.elements.timeDigit.value*h;d(j,g.target.elements.comment.value)}.bind(void 0)},"Set timer for ",React.createElement("input",{name:"timeDigit",type:"number"}),React.createElement("select",{className:"time-select",name:"time"},React.createElement("option",{value:"minute"},"minutes"),React.createElement("option",{value:"hour"},"hours"),React.createElement("option",{value:"day"},"days")),". Comment: ",React.createElement("input",{type:"text",name:"comment",className:"timer-comment-box"}),React.createElement("input",{type:"submit",value:"Save Timer"}))))};ReactDOM.render(React.createElement("div",{className:"topbar-dialog achievements-dialog dno",id:"timerDialogueChild"},React.createElement("div",{className:"header"},"Post Timers"),React.createElement("div",{className:"modal-content"},React.createElement(Group,{title:"Timers",getItems:getItems}))),timerDialogue);function createTimerPopup(c,d,f){ReactDOM.render(React.createElement(CreateTimerPopup,{postId:f,callback:function g(h,j){if(ReactDOM.unmountComponentAtNode(c),void 0!==h){var k=moment().add(h,"seconds").unix(),l="https://"+window.location.host+"/q/"+f;saveTimer(d,k,l,j,f)}}}),c)}
        // Insert timer link into post actions
        const postMenus = document.getElementsByClassName("post-menu");
        Array.from(postMenus).forEach(postMenu => {
            const postId = postMenu.getElementsByClassName("flag-post-link")[0].dataset.postid;
            const title = (document.getElementById("question-header").childNodes[1] || document.getElementsByClassName("question-hyperlink")[0]).innerText.trim();
            const popupParent = document.createElement("div");
            postMenu.appendChild(popupParent);
            const timerLink = document.createElement("a");
            timerLink.innerText = "timer";
            timerLink.onclick = () => {
                createTimerPopup(popupParent, title, postId);
            };
            postMenu.appendChild(timerLink);
        });
    }

    if (location.href.indexOf("/review/") !== -1) {
        // /review thinks that it's pretty smart and loads asynchronously. But you ain't gonna stop this userscript!
        $(document).ajaxSuccess(function(event, XMLHttpRequest, ajaxOptions) {
            if (ajaxOptions.url.indexOf("/review/next-task") == 0 || ajaxOptions.url.indexOf("/review/task-reviewed") == 0) {
                setTimeout(main, 1);
            }
        });
    } else {
        main();
    }
})();
