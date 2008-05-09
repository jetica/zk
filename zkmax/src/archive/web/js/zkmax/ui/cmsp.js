/* cmsp.js

{{IS_NOTE
	Purpose:
		Comet-based Server Push
	Description:
		The comet algorithm is long-polling
	History:
		Tue May  6 10:26:29     2008, Created by tomyeh
}}IS_NOTE

Copyright (C) 2008 Potix Corporation. All Rights Reserved.

{{IS_RIGHT
}}IS_RIGHT
*/
zkCmsp = {};
zkCmsp._reqs = {};
zkCmsp._start = {};
zkCmsp._nStart = 0;
zkCmsp._sid = 1; //1-999

zk.override(zkau, "ignoreESC", zkCmsp,
	function () {
		return zkCmsp.ignoreESC() || zkCmsp._nStart;
	});

zkCmsp.start = function (dtid) {
	++zkCmsp._nStart;
	zkCmsp._start[dtid] = true;
	zkCmsp._send(dtid);
};

zkCmsp.stop = function (dtid) {
	if (zkCmsp._start[dtid]) {
		--zkCmsp._nStart;
		zkCmsp._start[dtid] = false;
	}
	var req = zkCmsp._reqs[dtid];
	if (req) {
		zkCmsp._reqs[dtid] = null;
		try {
			if(typeof req.abort == "function") req.abort();
		} catch (e2) {
		}
	}
};

zkCmsp._send = function (dtid) {
	var req = zkCmsp._reqs[dtid] = zkau.ajaxRequest();
	try {
		req.onreadystatechange = zkCmsp._onRespReady;
		req.open("POST", zk.getUpdateURI("/comet?dtid="+dtid, false, null, dtid), true);
		req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
		req.setRequestHeader("ZK-SID", zkCmsp._sid);
		req.send();
	} catch (e) {
		zkCmsp._reqs[dtid] = null;
		zkCmsp._asend(dtid, 5000); //5 sec
	}
};
zkCmsp._asend = function (dtid, timeout) {
	if (zkCmsp._start[dtid])
		setTimeout("zkCmsp._send('" + dtid + "')", timeout);
};

zkCmsp._onRespReady = function () {
	try {
		for (var dtid in zkCmsp._reqs) {
			var req = zkCmsp._reqs[dtid], timeout = 2000;
			try {
				if (req && req.readyState == 4) {
					zkCmsp._reqs[dtid] = null;
					if (req.status == 200) {
						var sid = req.getResponseHeader("ZK-SID");
						if (!sid || sid == zkCmsp._sid) {
							var cmds = zkau.parseXmlResp(req.responseXML);
							if (cmds) {
								timeout = 100;
								zkau._respQue.push(cmds);
								if (sid && ++zkCmsp._sid > 999) zkCmsp._sid = 1;
								//both parseXmlResp and doQueResps might ex
							}
							zkau.doQueResps();
						}
					}
					zkCmsp._asend(dtid, timeout);
				}
			} catch (e) {
				zkCmsp._asend(dtid, 2000); //2 sec
			}
		}
	} catch (e) {
		//FF: complain zkCmsp not found if ESC. reason: unknown
	}
};
