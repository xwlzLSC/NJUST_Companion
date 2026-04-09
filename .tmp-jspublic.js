/*****************************************************************
    jspublic.js
    2007-10-06
    å°è£äºé¡¹ç®ä¸­æç¨å°çjså¬å±æ¹æ³
    ä¿®æ¹æ¥å¿ï¼
    	2008-04-07ï¼è§£å³éªè¯ç±»åä¸­çæ­»å¾ªç¯bug
    	2008-04-08ï¼å¢å emailçéªè¯æ¹æ³
    	
*****************************************************************/

/**
æ£æµå­ç¬¦çé¿åº¦
obj æéåæ°
msg å¼¹åºéè¯¯æ é¢
len [ææ¬åçé¿åº¦]å¯éé¡¹

è¿åå¼: true æè false
**/
function checkStringLen(obj,msg,len){

	var str=obj.value;
    var len2=0;
    for (var i=0; i<str.length; i++) {   
        if (str.charCodeAt(i)>127 || str.charCodeAt(i)==94) {   
            len2 += 2;   
        } else {   
            len2 ++;   
        }   
        }
   if(len2>len)
   {
    alert(msg+"é¿åº¦è¿é¿ï¼è¯·éæ°è¾å¥");
    obj.focus();
    
   return false;
   
   }
   else
   {
   return true;
   }
}

/*
 newèº«ä»½è¯éªè¯
 zjh éè¦éªè¯çèº«ä»½è¯å·ç 
 to by zhangbo
*/ 
function sfzYz(zjh){   
	validId(zjh) 
} 
var powers=new Array("7","9","10","5","8","4","2","1","6","3","7","9","10","5","8","4","2");      
var parityBit=new Array("1","0","X","9","8","7","6","5","4","3","2");      
         
//æ ¡éªèº«ä»½è¯å·ç çä¸»è°ç¨      
 
function validId(obj){      
    var _id=obj.value;      
    if(_id=="")return;      
    var _valid=false;      
    if(_id.length==15){      
        _valid=validId15(_id);      
    }else if(_id.length==18){      
        _valid=validId18(_id);      
    }      
    if(!_valid){      
        alert("èº«ä»½è¯å·ç æè¯¯,è¯·æ£æ¥!");      
        obj.focus();  
        obj.value="";
        return;      
    }      
          
}       
   
//æ ¡éª18ä½çèº«ä»½è¯å·ç       
function validId18(_id){      
    _id=_id+"";      
    var _num=_id.substr(0,17);      
    var _parityBit=_id.substr(17);      
    var _power=0;      
    for(var i=0;i< 17;i++){      
        //æ ¡éªæ¯ä¸ä½çåæ³æ§      
 
        if(_num.charAt(i)<'0'||_num.charAt(i)>'9'){      
            return false;      
            break;      
        }else{      
            //å æ      
 
            _power+=parseInt(_num.charAt(i))*parseInt(powers[i]);      
                  
        }      
    }      
    //åæ¨¡      
 
    var mod=parseInt(_power)%11;      
    if(parityBit[mod]==_parityBit){      
        return true;      
    }      
    return false;      
}     
 
//æ ¡éª15ä½çèº«ä»½è¯å·ç        
function validId15(_id){      
    _id=_id+"";      
    for(var i=0;i<_id.length;i++){      
        //æ ¡éªæ¯ä¸ä½çåæ³æ§      
 
        if(_id.charAt(i)<'0'||_id.charAt(i)>'9'){      
            return false;      
            break;      
        }      
    }      
    var year=_id.substr(6,2);      
    var month=_id.substr(8,2);      
    var day=_id.substr(10,2);      
    var sexBit=_id.substr(14);      
    //æ ¡éªå¹´ä»½ä½      
 
    if(year<'01'||year >'90')return false;      
    //æ ¡éªæä»½      
 
    if(month<'01'||month >'12')return false;      
    //æ ¡éªæ¥      
 
    if(day<'01'||day >'31')return false;      
      
    return true;      
} 

/** ***********å¯¹é¡µé¢æäº¤åbuttonæäº¤ï¼æ§å¶å­ç¬¦ä¸­å«æåå¼å·*****************/

var inputtext;
var numcs ;
function wantToDoSth() {  
     if (window.document.body) {
     	if(numcs != null || numcs!='undefined'){
     		clearTimeout(numcs); 
     	}
     	inputtext = new Array();
         var evl= document.getElementsByTagName('input');
          for(i=0;i<evl.length;i++)
          {
            if(evl[i].type=='submit'||evl[i].type=='button')
           {
				evl[i].attachEvent('onclick',  cc);
			}
			else if(evl[i].type=='text')
			inputtext.push(evl[i]);
		}
		 
		 var evl2= document.getElementsByTagName('textarea');
		      for(i=0;i<evl2.length;i++)
		      {
		         inputtext.push(evl2[i]);
		      }

     } else if(numcs == null || numcs=='undefined' || numcs==''){
        numcs=  setTimeout(wantToDoSth, 1000);
     }  
 }  
    
 //wantToDoSth(); æ´æ°ä¸ºæå¡ç«¯é²æ³¨å¥ 
function cc()
{
  //alert(inputtext);
  	for(i=0;i<inputtext.length;i++)
	{
  	//alert(inputtext[i].value);
 	 	var inputvalue = inputtext[i] ;
 		if(inputvalue.value.indexOf("'")>-1){
 		var array = new Array();
 		array = inputvalue.value.split("'");
 		var return_input = "";
 		//alert(array.length);
 		for(j=0;j<array.length;j++){
 			if(j < array.length -1 )
 			return_input += array[j]+"''";
 				else
 			return_input += array[j];
 		}
 		inputtext[i].value = return_input;
 		}
	}
}

/**********************************/
// æ£æ¥æ¥æååé¡ºåº,å¢å BY ZhangBo
// å¤æ­å¹´ä»½æ ¼å¼01 yyyy
// åæ°:ksnd(å¼å§å¹´åº¦),jsnd(ç»æå¹´åº¦),ksndMes(å¼å§å¹´åº¦),jsndMess(ç»æå¹´åº¦)
function dateKsndVs(ksnd,jsnd,ksndMes,jsndMess){ 
   var ksxn = ksnd.value;
   var jsxn = jsnd.value;
   var ksmes = ksndMes;
   var jsmes = jsndMess; 
   if(ksxn > jsxn ){ 
    alert("ç³»ç»æç¤ºï¼"+jsndMess+"ä¸è½å°äº"+ksmes+",è¯·éæ°è¾å¥ï¼");
    jsnd.value ='';
    return false;
   } 
}
// å¤æ­å¹´ä»½æ ¼å¼02 yyyyMMdd
// åæ°:zzsj(ç»æ­¢æ¶é´),qsdj(èµ·å§æ¶é´),zzMes(ç»æ­¢æ¶é´),qsMes(èµ·å§æ¶é´)
function dateZzsjVsQssj(zzsj,qsdj,qsMes,zzMes){   
	var zzms =zzMes;
	var qsms = qsMes; 
	 if(!CheckDate(zzsj)){
	 if(qsdj.value.length>0){
	  	var begindat=qsdj.value.split('-');
	 	var endat=zzsj.value.split('-');  
	  	var dat1=begindat[0]+begindat[1]+begindat[2];
	   	var dat2=endat[0]+endat[1]+endat[2];  
	    if(dat1> dat2){
	        alert(""+zzMes+"ä¸è½å°äº"+qsMes+",è¯·éæ°è¾å¥ï¼");
	         
	        zzsj.focus();
	        return false;
	    }
	  }
	}
	return true;
}
//å¤æ­èµ·å§æ¶é´åç»éæ¶é´
function compdate(sid,eid){
var s=document.getElementById(sid).value;
var e=document.getElementById(eid).value;

if(s=="" || e==""){
	return true;
	}
	s=s.replace(/-/g,"/");
	e=e.replace(/-/g,"/");
	//alert(Date.parse(e)-Date.parse(s));
	if(Date.parse(s)-Date.parse(e)>0){   
    alert("èµ·å§æ¥æè¦å¨ç»ææ¥æä¹å!"); 
    //document.getElementById(sid).focus();
    return false;   
    }  
	return true;
}

 //å¢å äºä»¶2010-09-18(è§£å³éè¯¾å¤çè°ç¨æ¶çJSé®é¢)
function newJsMAdd(htmlurl,tmpWidth,tmpHeight){
	var newwin = window.showModalDialog(htmlurl,window,"dialogWidth:"+tmpWidth+"px;status:no;dialogHeight:"+tmpHeight+"px");
	if (newwin == null){
		creating.style.visibility='visible';
		//window.Form1.PlAction.value="";
		window.Form1.submit();
		//document.getElementById('alldiv').disabled = true;
	}
	else if (newwin == "ok"){
		if (confirm("æ¯å¦åæ¬¡å¢å è®°å½ï¼")){
			JsMAdd(htmlurl,tmpWidth,tmpHeight);
		}
		else{
			creating.style.visibility='visible';
			///window.Form1.PlAction.value="";
			window.Form1.submit();
			///document.getElementById('alldiv').disabled = true;
		}
	}else{
		window.Form1.submit();
	}
}
  
//å å¥jsæä»¶,ä¿®æ¹BY chenwen
function getRootPath(){
	var strFullPath=window.document.location.href;
	var strPath=window.document.location.pathname;
	var pos=strFullPath.indexOf(strPath);
	var prePath=strFullPath.substring(0,pos);
	var postPath=strPath.substring(0,strPath.substr(1).indexOf('/')+1);
	return(prePath+postPath);
}
//æ£æµTextareaå¤§å°
//v1å¯¹è±¡å­æ®µåç§°
//å¼¹åºè¯­å¥
//Textareaå¼çæå¤§é¿åº¦
function checkTextarea(v1,v2,v3){
var hjyy = v1.value; 
if(hjyy.length > v3){
v1.value = "";
v1.focus();
alert(v2);
return false;
}
}
function addJS(filePath)
{
	if(filePath) {
		var js = document.createElement('script');
		js.type = 'text/javascript';
		js.src =  getRootPath() + filePath;
		document.getElementsByTagName("head")[0].appendChild(js);
	}
}
//addJS('/dwr/engine.js');
//addJS('/dwr/util.js');
//addJS('/dwr/interface/dwrMonitor.js');
//addJS('/js/validate.js');

var checkonly_msg = "";
var checkonly_submitId = "submit_add";
var checkonly_spanId = "checkmessage_";
var checkonly_oldvalue = [];
var checkonly_field = "";

/*
 *useIsdel æ¯å¦å¯ç¨ isdelï¼ä¼ å¼trueæèå¶ä»å¼ï¼å½ä¸ºtrueæ¶ï¼ç³»ç»ä¼èªå¨å¢å isdel=0çæ¡ä»¶ã
 */
function checkIsOnly(tableName,fieldName,object,msg,submitId,spanId,useIsdel) {
	DWREngine.setAsync(false);
	checkonly_spanId = checkonly_spanId + fieldName;
	if(msg!=undefined)
		checkonly_msg = msg;
	if(submitId!=undefined)
		checkonly_submitId = submitId;
	if(spanId!=undefined)
		checkonly_spanId = spanId;
	var value = object.value;
	var checkonly_oldvalue_temp = fieldName + "$" + trimstr(value);
	var isOld = true;
	for(var kk=0;kk<checkonly_oldvalue.length;kk ++) {
		if(checkonly_oldvalue_temp == checkonly_oldvalue[kk]) {
			isOld = false;
			break;
		}
	}
	if(isOld)
		dwrMonitor.checkIsOnly(tableName,fieldName,value,useIsdel,checkOnlyResult);
	else {
		document.getElementById(checkonly_spanId).innerHTML = "";
		var isCanSubmit = true;
		var checkonly_field_temps = checkonly_field.split(",");
		for(var jj=0;jj<checkonly_field_temps.length;jj++) {
			if(trimstr(checkonly_field_temps[jj]) != "") {
				if(document.getElementById("checkmessage_"+checkonly_field_temps[jj]).innerHTML != "") {
					isCanSubmit = false;
				}
			}
		}
		if(isCanSubmit)
			document.getElementById(checkonly_submitId).disabled = false;
		checkonly_spanId = "checkmessage_";
		return false;
	}
	return true;
}

function checkIsOnlyAll(tableName,mapdata,msg,submitId,spanId) {
	DWREngine.setAsync(false);
	checkonly_spanId = spanId;
	if(msg!=undefined)
		checkonly_msg = msg;
	if(submitId!=undefined)
		checkonly_submitId = submitId;
	if(spanId!=undefined)
		checkonly_spanId = spanId;

	dwrMonitor.checkIsOnlyAll(tableName,mapdata,checkOnlyResult);
}

/**
* æ ¸æ¥è¾å¥çå¼å¨æ°æ®åºä¸­æ¯å¦å­å¨
*/
function checkOnlyResult(result) {
	if(result == "N" || result == "true") {
		document.getElementById(checkonly_spanId).innerHTML = "<font color='red' size='2'>æ­¤"+checkonly_msg+"å·²ç»è¢«ä½¿ç¨ï¼</font>";
		document.getElementById(checkonly_submitId).disabled = true;
		alert("æ­¤"+checkonly_msg+"å·²ç»è¢«ä½¿ç¨ï¼");	
	}else{
		document.getElementById(checkonly_spanId).innerHTML = "";
		var msg_temp = checkonly_spanId.replace("checkmessage_","");
		var isCanSubmit = true;
		var checkonly_field_temps = checkonly_field.split(",");
		for(var jj=0;jj<checkonly_field_temps.length;jj++) {
			if(trimstr(checkonly_field_temps[jj]) != "") {
				if(document.getElementById("checkmessage_"+checkonly_field_temps[jj]).innerHTML != "") {
					isCanSubmit = false;
				}
			}
		}
		if(isCanSubmit)
			document.getElementById(checkonly_submitId).disabled = false;
	}
	checkonly_spanId = "checkmessage_";
}

//æ ¼å¼åæ¥ææ¹å¼
Date.prototype.format = function(format){
    var o =
    {
        "M+" : this.getMonth()+1, //month
        "d+" : this.getDate(),    //day
        "h+" : this.getHours(),   //hour
        "m+" : this.getMinutes(), //minute
        "s+" : this.getSeconds(), //second
        "q+" : Math.floor((this.getMonth()+3)/3),  //quarter
        "S" : this.getMilliseconds() //millisecond
    }
    if(/(y+)/.test(format))
    format=format.replace(RegExp.$1,(this.getFullYear()+"").substr(4 - RegExp.$1.length));
    for(var k in o)
    if(new RegExp("("+ k +")").test(format))
    format = format.replace(RegExp.$1,RegExp.$1.length==1 ? o[k] : ("00"+ o[k]).substr((""+ o[k]).length));
    return format;
}

//æå¼ä¸ä¸ªçªå£
function JsOpenWin(htmlurl,tmpWidth,tmpHeight){
   var  top = ((window.screen.availHeight-document.body.clientHeight)/2);  
   var  left = ((window.screen.availWidth-document.body.clientWidth)/2);  
	window.open(htmlurl, "printsetup", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,top=" 
		+ top
		+ " ,left=" 
		+ left
		+ ",width="+tmpWidth+"px,height=" + tmpHeight + "px");
}

/////////////////////////////////////////////////////å¤çé¡µé¢æ ç­¾ä¸­çæ¥è¯¢é¨åèæ¬
function ListSearch(SearchNum) {
	var tmpstr = " and (";
	for (i = 1; i <= SearchNum; i++) {
		if (document.all("SValue" + i).value != "") {
			tmpstr = tmpstr + document.all("Field" + i).value + " " + document.all("HH" + i).value;
			if (document.all("HH" + i).value == "like" || document.all("HH" + i).value == "not like") {
				tmpstr = tmpstr + " ^%" + sqlReplace(document.all("SValue" + i).value) + "%^ ";
			} else {
				tmpstr = tmpstr + " ^" + sqlReplace(document.all("SValue" + i).value) + "^ ";
			}
			
			if (i < SearchNum) {
				for (j = i + 1; j <= SearchNum; j++) {
					if (document.all("SValue" + j).value != "") {
						tmpstr = tmpstr + " " + document.all("AndOr" + i).value + " ";
						break;
					}
				}
			}
		}
	}
	if (tmpstr != " and (") {
		window.Form1.where2.value =" 1=1 " + tmpstr + ")";
		
	} else {
		window.Form1.where2.value = " 1 = 1";
	}
	window.Form1.submit();
}
//è¿æ»¤éæ³å­ç¬¦
function sqlReplace(str){
	//var val = str.replace(/'/g,"''");
	var val = str;
	return val;
}
function ListSearchs(SearchNum,sqlwhere) {
	var tmpstr = " and ";
	if(SearchNum == 1){
	SearchNum++;
	}
	for (i = 1; i <= SearchNum; i++) {
		if (document.all("SValue" + i).value != "") {
			tmpstr = tmpstr + document.all("Field" + i).value + " " + document.all("HH" + i).value;
			if (document.all("HH" + i).value == "like" || document.all("HH" + i).value == "not like") {
				tmpstr = tmpstr + " ^%" + sqlReplace(document.all("SValue" + i).value) + "%^ ";
			} else {
				tmpstr = tmpstr + " ^" + sqlReplace(document.all("SValue" + i).value) + "^ ";
			}
			if (i < SearchNum) {
				for (j = i + 1; j <= SearchNum; j++) {
					if (document.all("SValue" + j).value != "") {
						tmpstr = tmpstr + " " + document.all("AndOr" + i).value + " ";
						break;
					}
				}
			}
		}
	}
	if (tmpstr != " and ") {
		window.Form1.where1.value = " 1=1 " + tmpstr + sqlwhere;
	} else {
		window.Form1.where1.value = " 1 = 1 " + sqlwhere;
	}
	window.Form1.submit();
}
/////////////////////////////////////////////////////éå®è¡¨å¤´èæ¬
function DrawTable(scrTable, newTable, iStart, iEnd, jEnd) {
	var i, j, k = 0, newTR, newTD, intWidth = 0, intHeight = 0;
	newTable.mergeAttributes(scrTable);
	for (i = iStart; i < iEnd; i++) {
		newTR = newTable.insertRow(k);
		newTR.mergeAttributes(scrTable.rows[i]);
		intHeight += scrTable.rows[i].offsetHeight;
		intWidth = 0;
		for (j = 0; j < (jEnd == -1 ? scrTable.rows[i].cells.length : jEnd); j++) {
			newTD = scrTable.rows[i].cells[j].cloneNode(true);
			intWidth += scrTable.rows[i].cells[j].offsetWidth;
			newTR.insertBefore(newTD);
			newTD.style.pixelWidth = scrTable.rows[i].cells[j].offsetWidth;
		}
		k++;
	}
	newTable.style.pixelWidth = intWidth;
	newTable.style.pixelHeight = intHeight;
}

function LockTable(arTable, ColNum, RowHead, RowFoot) {
	arTable.HeadRow = RowHead;
	var objDivMaster = arTable.parentElement;
	if (objDivMaster.tagName != "DIV") {
		return;
	}
	if ((arTable.offsetHeight > objDivMaster.offsetHeight) && (arTable.offsetWidth > objDivMaster.offsetWidth)) {
		if ((ColNum > 0) && (RowHead > 0)) {
			var objTableLH = document.createElement("TABLE");
			var newTBody = document.createElement("TBODY");
			objTableLH.insertBefore(newTBody);
			objTableLH.id = "objTableLH";
			objDivMaster.parentElement.insertBefore(objTableLH);
			DrawTable(arTable, objTableLH, 0, RowHead, ColNum);
			objTableLH.srcTable = arTable;
			with (objTableLH.style) {
				zIndex = 804;
				position = "absolute";
				pixelLeft = objDivMaster.offsetLeft;
				pixelTop = objDivMaster.offsetTop;
			}
		}
		if ((ColNum > 0) && (RowFoot > 0)) {
			var objTableLF = document.createElement("TABLE");
			var newTBody = document.createElement("TBODY");
			objTableLF.insertBefore(newTBody);
			objTableLF.id = "objTableLF";
			objDivMaster.parentElement.insertBefore(objTableLF);
			DrawTable(arTable, objTableLF, arTable.rows.length - RowFoot, arTable.rows.length, ColNum);
			objTableLF.srcTable = arTable;
			with (objTableLF.style) {
				zIndex = 803;
				position = "absolute";
				pixelLeft = objDivMaster.offsetLeft;
				pixelTop = objDivMaster.offsetTop + objDivMaster.offsetHeight - objTableLF.offsetHeight - 16;
			}
		}
	}
	if ((RowHead > 0) && (arTable.offsetHeight > objDivMaster.offsetHeight)) {
		var DivHead = document.createElement("DIV");
		objDivMaster.parentElement.insertBefore(DivHead);
		var objTableHead = document.createElement("TABLE");
		var newTBody = document.createElement("TBODY");
		objTableHead.id = "HeadTar";
		objTableHead.style.position = "relative";
		objTableHead.insertBefore(newTBody);
		DivHead.insertBefore(objTableHead);
		DrawTable(arTable, objTableHead, 0, RowHead, -1);
		HeadTar.srcTable = arTable;
		with (DivHead.style) {
			overflow = "hidden";
			zIndex = 802;
			pixelWidth = objDivMaster.offsetWidth - 16;
			position = "absolute";
			pixelLeft = objDivMaster.offsetLeft;
			pixelTop = objDivMaster.offsetTop;
		}
		objDivMaster.attachEvent("onscroll", divScroll1);
	}
	if ((RowFoot > 0) && (arTable.offsetHeight > objDivMaster.offsetHeight)) {
		var DivFoot = document.createElement("DIV");
		objDivMaster.parentElement.insertBefore(DivFoot);
		var objTableFoot = document.createElement("TABLE");
		var newTBody = document.createElement("TBODY");
		objTableFoot.insertBefore(newTBody);
		objTableFoot.id = "FootTar";
		objTableFoot.style.position = "relative";
		DivFoot.insertBefore(objTableFoot);
		DrawTable(arTable, objTableFoot, arTable.rows.length - RowFoot, arTable.rows.length, -1);
		objTableFoot.srcTable = arTable;
		with (DivFoot.style) {
			overflow = "hidden";
			zIndex = 801;
			pixelWidth = objDivMaster.offsetWidth - 16;
			position = "absolute";
			pixelLeft = objDivMaster.offsetLeft;
			pixelTop = objDivMaster.offsetTop + objDivMaster.offsetHeight - DivFoot.offsetHeight - 16;
		}
		objDivMaster.attachEvent("onscroll", divScroll2);
	}
	if ((ColNum > 0) && (arTable.offsetWidth > objDivMaster.offsetWidth)) {
		var DivLeft = document.createElement("DIV");
		objDivMaster.parentElement.insertBefore(DivLeft);
		var objTableLeft = document.createElement("TABLE");
		var newTBody = document.createElement("TBODY");
		objTableLeft.insertBefore(newTBody);
		objTableLeft.id = "LeftTar";
		objTableLeft.style.position = "relative";
		DivLeft.insertBefore(objTableLeft);
		DrawTable(arTable, objTableLeft, 0, arTable.rows.length, ColNum);
		LeftTar.srcTable = arTable;
		with (DivLeft.style) {
			overflow = "hidden";
			zIndex = 800;
			pixelWidth = objDivMaster.offsetWidth - 16;
			pixelHeight = objDivMaster.offsetHeight - 16;
			position = "absolute";
			pixelLeft = objDivMaster.offsetLeft;
			pixelTop = objDivMaster.offsetTop;
		}
		objDivMaster.attachEvent("onscroll", divScroll3);
	}
}
function divScroll1() {
	var tbl = document.all("HeadTar").srcTable, parDiv = tbl.parentElement;
	while (parDiv.tagName != "DIV") {
		parDiv = parDiv.parentElement;
	}
	window.status = -parDiv.scrollLeft;
	document.all("HeadTar").style.pixelLeft = -parDiv.scrollLeft;
}
function divScroll2() {
	var tbl = document.all("FootTar").srcTable, parDiv = tbl.parentElement;
	while (parDiv.tagName != "DIV") {
		parDiv = parDiv.parentElement;
	}
	window.status = -parDiv.scrollLeft;
	document.all("FootTar").style.pixelLeft = -parDiv.scrollLeft;
}
function divScroll3() {
	var tbl = document.all("LeftTar").srcTable, parDiv = tbl.parentElement;
	while (parDiv.tagName != "DIV") {
		parDiv = parDiv.parentElement;
	}
	window.status = -parDiv.scrollLeft;
	document.all("LeftTar").style.pixelTop = -parDiv.scrollTop;
}
/////////////////////////////////////////////////////éå®è¡¨å¤´èæ¬ç»æ

/////////////////////////////////////////////////////æå¨åå®½èæ¬
function MouseDownToResize(obj) {
	obj.mouseDownX = event.clientX;
	obj.pareneTdW = obj.parentElement.offsetWidth;
	obj.pareneTableW = mxh.offsetWidth;
	obj.setCapture();
}
function MouseMoveToResize(obj, clo) {
	if (!obj.mouseDownX) {
		return false;
	}
	var newWidth = obj.pareneTdW * 1 + event.clientX * 1 - obj.mouseDownX;
	if (newWidth > 0) {
		obj.parentElement.style.width = newWidth;
	  if (document.getElementById("mxh").rows[0] != undefined)
        {
            for (i = 0; i < document.getElementById("mxh").rows.length; i++){
            	try{
            		document.getElementById("mxh").rows[i].cells[clo].style.width = newWidth;
            	}catch(e){
            	}
            }               
        }
		document.getElementById("tblHeadDiv").style.pixelLeft = -document.getElementById("mxhDiv").scrollLeft;
	}
}
function MouseUpToResize(obj) {
	obj.releaseCapture();
	obj.mouseDownX = 0;
}
/////////////////////////////////////////////////////æå¨åå®½èæ¬ç»æ
function formSubmit(page) {
	document.forms[0].submit();
}
function gb_bgcolor(e, iRowID) {
	ioldSelectRow = document.getElementById("oldSelectRow").value;
	if (ioldSelectRow != "") {
		document.getElementById(ioldSelectRow).bgColor = "";
	}
	e.bgColor = "#cccccc";
	document.getElementById("oldSelectRow").value = iRowID;
}
//æ°çéæ©åè¡¨è¡çäºä»¶
//æ°çéæ©åè¡¨è¡çäºä»¶
function gb_bgcolor2(e, iRowID) {
	ioldSelectRow = document.getElementById("oldSelectRow").value;
	
	if (ioldSelectRow != "") {
	    try{
			document.getElementById(ioldSelectRow).style.backgroundColor = "";
		}
		catch(eii){}
	}
	e.style.backgroundColor = "#C4DEFD";
	document.getElementById("oldSelectRow").value = iRowID;
}

function doWhereKey(e) {
	document.getElementById("key_where").value = document.getElementById("key_where_" + e.id).value;
	alert("key_where:" + document.getElementById("key_where").value);
}

function doAWhereKey(e) {
	document.getElementById("key_where").value = document.getElementById("key_where_" + e.id.toString().substr(1)).value;
	alert("key_where:" + document.getElementById("key_where").value);
}

/////////////////////////////////////////////////////å¨éèæ¬ï¼å¨éç¨åè¡¨æ è®°åºä¸­ä½¿ç¨
function SelectAll() {
	if (document.all.C_Select == null)
		return;
	if (document.all.C_Select.length == null) {
	if(!document.all.C_Select.disabled && !document.all.C_Select.parentElement.disabled)
		document.all.C_Select.checked = document.all.C_SelectALL.checked;
	} else {
		for (i = 0; i < document.all.C_Select.length; i++) {
			if(!document.all.C_Select[i].disabled && !document.all.C_Select[i].parentElement.disabled)
				document.all.C_Select[i].checked = document.all.C_SelectALL.checked;
		}
	}
}

/////////////////////////////////////////////////////éæ©æ¹éæä½çåå®¹
function ChangeSzValue() {
   if (document.all.ZdSzNr.value == ''){
      document.all.ZdSzValue.readOnly = true;
      document.all.cmdselect.style.visibility = "hidden";
   }
   else{
    		//ä»£ç :ç±»å:ä¸æéæ©SQL
    var dmbz = document.all.ZdSzNr.value.split(":");
    		//å­å¸çè®¾ç½®å¼
	document.all.ZdSzValue.value = "";
	//å­å¸ä»£ç 
	document.all.ZdSzCode.value = dmbz[0];
		//å­å¸çæ¾ç¤ºåå®¹
	document.all.ZdSzCodeValue.value = "";
		// å¦ææå­å¸åå®¹æ¾ç¤ºå­å¸åå®¹
	if (dmbz.length > 2){
      document.all.ZdSzValue.readOnly = true;
      document.all.cmdselect.style.visibility = "visible";
		}else {// ä¸æ¯å­å¸			
	  document.all.ZdSzValue.readOnly = false;
      document.all.cmdselect.style.visibility = "hidden";
	}
  }
  document.getElementById('ZdSzCodeValue').value = "";
  document.getElementById('ZdSzValue').value = "";
  document.getElementById('ZDSXkeydm').value = "";
  document.getElementById("hiddenframe").style.display = "none";
}
/*
//æ¹éè®¾ç½®äºä»¶
function ZdSz() {
	if (document.all.ZdSzNr.value == "") {
		alert("è¯·åæå®è¦è®¾ç½®çåå®¹!");
		document.all.ZdSzNr.focus();
		return false;
	}
	if (document.all.ZdSzValue.value == "") {
		alert("è¯·åæå®è¦è®¾ç½®çå¼!");
		document.all.ZdSzValue.focus();
		return false;
	}
	if (!CheckCanDelete("è®¾ç½®<" + document.all.ZdSzNr.options[document.all.ZdSzNr.selectedIndex].text+">")) {
		return false;
	}
	document.all.ZdSzValueTemp.value = document.all.ZdSzValue.value;
	document.all.PlAction.value = "set";
	ZdZcing.style.visibility = "visible";
	document.Form1.submit();
	ZdZcing.style.visibility = "hidden";
}*/
//æ¹éè®¾ç½®äºä»¶
function ZdSz() {
	
	if (document.getElementById("ZdSzNr").value == "") {
		alert("è¯·åæå®è¦è®¾ç½®çåå®¹!");
		document.all.ZdSzNr.focus();
		return false;
	}
	if (document.getElementById("ZdSzValue").value == "") {
		alert("è¯·åæå®è¦è®¾ç½®çåå®¹!");
		document.all.ZdSzValue.focus();
		return false;
	}
	

	var c_select=document.getElementsByName("C_Select");
	var val="",isSelect=false;	

	//å¤æ­æ¯å¦éå®è®°å½
	for(var i=0;i<c_select.length;i++) {
		if(c_select[i].checked==true){// No selected å±æ§
			val+="'"+c_select[i].value+"',";
			isSelect=true;
		}
	}
	if(!isSelect) {
		alert('æå®è®¾ç½®æ æï¼æ²¡æéæ©è®°å½ï¼');
		return false;
	}else {
	var patrn=/^0+\.*[0-9]*$/;//æ©å±æ°æ®ç±»å
	var type=document.all.ZdSzNr.value.split(":")[1];
	//ä¸´æ¶è§£å³å¯¼å­¦æ¶åç±»å¸¦äº0é æå¨å¼è¯¾éç¥åä¸­ä¸è½ä¿®æ¹å­¦æ¶ä¿¡æ¯
		if(type=="01" || type=="02" || type=="03" || type=="04" || type=="05")
	{
	   type=parseInt(type);
	}
	var isnum=!patrn.exec(type);
		if(!isnum){
			var result=false;
			if(type=='0'){
			result=checkNumber(document.all.ZdSzValue);	
			}	
			else if(type=='0.1'){
			result=checkNumber(document.all.ZdSzValue);	
			if(document.all.ZdSzValue.value<0 && result){
			alert("å¿é¡»ä¸ºå¤§äº0çæ°å­");
			result=false;
			}
			}else if(type=='0.2'){
			result=checkIntegerIsTun(document.all.ZdSzValue);
			}		
			if(result==true) {
				ZdZcing.style.visibility = "visible";
				if(document.all.ZdSzValueTemp.value=='')
					document.all.ZdSzValueTemp.value = document.all.ZdSzValue.value;					
				document.all.PlAction.value = "set";
				document.all.ZDSXkeydm.value = document.all.ZdSzNr.value;
				document.all.ZdSzCodeValue.value = document.all.ZdSzValue.value;				
				//document.Form1.submit();
				//ZdZcing.style.visibility = "hidden";
			}else{
				ZdZcing.style.visibility = "hidden";
				return false;
			}
		}
		if (!CheckCanDelete("è®¾ç½®<" + document.all.ZdSzNr.options[document.all.ZdSzNr.selectedIndex].text+">")) {
		ZdZcing.style.visibility = "hidden";
			return false;
		}
		
		//è®¾ç½®å¼		
		ZdZcing.style.visibility = "visible";
		if(document.all.ZdSzValueTemp.value=='')
			document.all.ZdSzValueTemp.value = document.all.ZdSzValue.value;
		document.all.PlAction.value = "set";
		document.all.ZDSXkeydm.value = document.all.ZdSzNr.value;
		document.all.ZdSzCodeValue.value = document.all.ZdSzValue.value;
		document.forms(0).action = "";
		if(document.getElementById("userModifyUrl").value != "") {
			var modFieldName = document.getElementById("ZdSzNr").value.split(":")[0];
			var userModFields = document.getElementById("userModifyUrl").value.split(",");
			for(var i=0;i<userModFields.length;i++) {
				if(userModFields[i].split(":")[0] == modFieldName) {
					document.forms(0).action = userModFields[i].split(":")[1];
					break;
				}
			}
		}
		document.Form1.submit();
		ZdZcing.style.visibility = "hidden";
		document.all.PlAction.value = "";
		document.all.ZdSzValueTemp.value = "";
	}	
}

//éæ©æ¥è¯¢æä½çåå®¹
function szSearchValue(i) {
	var searchF = document.all('Field'+i).value;
	document.all('SValue'+i).value = "";
	if (document.all('Field'+i).value == ''){
      		document.all('cmdselectS'+i).style.visibility = "hidden";
   	}else {
    		//ä»£ç :ç±»å:ä¸æéæ©SQL
    		var dmbz = searchF.split(":");
		//å­å¸ä»£ç 
		document.all.ZdSzCode.value = dmbz[0];
		//å­å¸çæ¾ç¤ºåå®¹
		document.all.ZdSzCodeValue.value = "";
		// å¦ææå­å¸åå®¹æ¾ç¤ºå­å¸åå®¹
		if (dmbz.length > 2){
      			document.all('cmdselectS'+i).style.visibility = "visible";
		}else {// ä¸æ¯å­å¸			
	  		document.all('cmdselectS'+i).style.visibility = "hidden";
			if (dmbz[1]=="10") {
				document.all('SValue'+i).value = "yyyy-MM-dd";
			}else if (dmbz[1]=="11") {
				document.all('SValue'+i).value = "yyyy-MM-dd hh:mm:ss";
			}else if (dmbz[1]=="12") {
				document.all('SValue'+i).value = "yyyyMM";
			}else if (dmbz[1]=="13") {
				document.all('SValue'+i).value = "yyyyMMdd";
			}else if (dmbz[1]=="14") {
				document.all('SValue'+i).value = "yyyyMMddhhmmss";
			}
		}
  	}
	document.getElementById('ZdSzCodeValue').value = "";  	
  	document.getElementById('ZDSXkeydm').value = "";
  	document.getElementById("hiddenframe").style.display = "none";
}

//æ¥è¯¢æä½éæ©å¼¹åºiframe
function ChooseHiddenframeS(i){
	var tmpUrl = "../../selectDictionary.do?method=execute&typeCode="+i+"&type=" + document.all('Field'+i).value;
	var abe=getLTWH(document.getElementById('SValue'+i));

	document.getElementById("hiddenframe").style.position = "absolute";
    	document.getElementById("hiddenframe").style.border = 0;
	document.getElementById("hiddenframe").width = 205;
	document.getElementById("hiddenframe").height = 225;
    	document.getElementById("hiddenframe").style.pixelLeft = abe.left;
	document.getElementById("hiddenframe").style.top = abe.top;
	document.getElementById("hiddenframe").style.display = "";
    	window.frames["hiddenframe"].location = tmpUrl;	
}
//æ£æ¥æ°æ®ç±»åäºä»¶
function CheckDataLx(obj, Lx) {
	s_array_objvalue = obj.value.toString().split("|");
	tmpstr = s_array_objvalue[0];
	if (trimstr(tmpstr) != "") {
		if (Lx == "number") {
			if (!checkNum(tmpstr)) {
				alert("å¿é¡»è¾å¥æ°å­ï¼");
				obj.focus();
				obj.value = "";
				try {
					return false;
				}
				catch (exception) {
					return false;
				}
			}
		} else {
			if (Lx == "date") {
				if (!checkDate(tmpstr)) {
					alert("å¿é¡»è¾å¥æ¥ææ ¼å¼ï¼ä¾å¦ï¼2007-01-01");
					obj.value = "";
					obj.focus();
					try {
						return false;
					}
					catch (exception) {
						return false;
					}
				}
			}
		}
	}
	return true;
}

//JSä¸­çTrimæ¹æ³ï¼æ¿æ¢å­ç¬¦ä¸²ä¸­çç©ºæ ¼
function trimstr(s){
  return s.replace(/(^\s*)|(\s*$)/g, ""); 
}


//æ¹éè®¾ç½®éæ©å¼äºä»¶
function SelectValueCode() {
	var batchSeter = document.all.batchSeter.value;
	var ZdSzCode = document.all.ZdSzCode.value;
	var zdBeanName = document.all.zdBeanName.value;
	var htmlurl = "public.do?method=ZdSearch&ZdSzCode=" + ZdSzCode + "&zdBeanName=" + zdBeanName + "&batchSeter=" + batchSeter;
	var newwin = window.open(htmlurl, "_blank", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,top=" + (screen.availheight / 2 - 147) + " ,left=" + (screen.availwidth / 2 - 110) + ",width=220,height=330");
}

//æ¹éå é¤äºä»¶
function DeleteSelectedData(iPageNum) {
	if (!CheckCanDelete("å é¤")) {
		return false;
	}
	document.Form1.PlAction.value = "del";
	creating.style.visibility = "visible";
	document.Form1.submit();
	document.getElementById('alldiv').disabled = true;
	document.all.PlAction.value = "";
	creating.style.visibility = "hidden";
}

//æ£æ¥å¤éèæ¬
function CheckCanDelete(strOper) {
	var CanDelete = false;
	if (document.all.C_Select == null) {
		CanDelete = false;
	} else {
		if (document.all.C_Select.length == null ) 
			CanDelete = document.all.C_Select.checked;
		else{
			for (i = 0; i < document.all.C_Select.length; i++) {
				if (document.all.C_Select[i].checked) {
					CanDelete = true;
					break;
				}
			}
		}
	}
	if (!CanDelete) {
		alert("æå®" + strOper + "æ æï¼æ²¡æéæ©è®°å½ï¼");
		return false;
	}else if (!confirm("æ¨æéæ©çè®°å½å°è¢«æå®" + strOper + "ï¼ç»§ç»­ï¼")) {
		return false;
	}
	return true;
}

//æå¼ä¸ä¸ªæ¨¡æçªå£
function JsMod(htmlurl,tmpWidth,tmpHeight){
htmlurl=getRandomUrl(htmlurl);
	var newwin = window.showModalDialog(htmlurl,window,"dialogWidth:"+tmpWidth+"px;status:no;dialogHeight:"+tmpHeight+"px");
	if (newwin != null && newwin == "ok"){
	    	creating.style.visibility='visible';
			window.Form1.PlAction.value="";
	    	window.Form1.submit();
	    	document.getElementById('alldiv').disabled = true;
	}
} 
//éè¿Servletçéç¨è®¾ç½®ä¸ªæ§ååè¡¨ urlå¿é¡»å¸¦è·¯å¾,æ ¼å¼å¦/jiaowu/kkgl/listKktzd.jsp
function setPrivateShowByServlet(url,root) {
	htmlurl = root+"/PublicPrivateShowServlet?url=" + url;
	var newwin = window.open(htmlurl, "_blank", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=no,top=" + (screen.availheight / 2 - 220) + " ,left=" + (screen.availwidth / 2 - 150) + ",width=300,height=440");
}

//éè¿Servletçéç¨æå°
function printSetupByServlet(title) {
	htmlurl = "../PublicListPrintServlet?TblName=" + title;
	var newwin = window.open(htmlurl, "_blank", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,top=" + (screen.availheight / 2 - 220) + " ,left=" + (screen.availwidth / 2 - 150) + ",width=300,height=440");
}

//éè¿Servletçsqléç¨æå°
function printSetupByServlet3(title,root,isSql) {
	htmlurl = root+"/PublicListPrintServlet?TblName=" + title+"&isSql="+isSql;
	var newwin = window.open(htmlurl, "_blank", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,top=" + (screen.availheight / 2 - 220) + " ,left=" + (screen.availwidth / 2 - 150) + ",width=300,height=440");
}

//éè¿Servletçéç¨æå°2å¸¦WEBæ ¹
var newwin_printSetupByServlet;
function printSetupByServlet2(title,root) {
if(newwin_printSetupByServlet){
newwin_printSetupByServlet.close();
	}
	htmlurl = root+"/PublicListPrintServlet?TblName=" + title;
	newwin_printSetupByServlet = window.open(htmlurl, "_blank", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,top=" + (screen.availheight / 2 - 220) + " ,left=" + (screen.availwidth / 2 - 150) + ",width=300,height=440");
}

//éè¿Servletçéç¨æå°4å¸¦WEBæ ¹
function printSetupByServlet4(title,root,url) {
	htmlurl = root+"/PublicListPrintServlet?TblName=" + title+"&url="+url;
	var newwin = window.open(htmlurl, "_blank", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,top=" + (screen.availheight / 2 - 220) + " ,left=" + (screen.availwidth / 2 - 150) + ",width=300,height=440");
}

//éè¿Servletçéç¨æå°5å¸¦WEBæ ¹
function printSetupByServlet5(title,root,isSql,url) {
	htmlurl = root+"/PublicListPrintServlet?TblName=" + title+"&url="+url+"&isSql="+isSql;
	var newwin = window.open(htmlurl, "_blank", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,top=" + (screen.availheight / 2 - 220) + " ,left=" + (screen.availwidth / 2 - 150) + ",width=300,height=440");
}
//æå¼ä¸ä¸ªçªå£
function JsOpenWin(htmlurl,tmpWidth,tmpHeight){
   var  top = ((window.screen.availHeight-document.body.clientHeight)/2);  
   var  left = ((window.screen.availWidth-document.body.clientWidth)/2);  
	window.open(htmlurl, "printsetup", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,top=" 
		+ top
		+ " ,left=" 
		+ left
		+ ",width="+tmpWidth+"px,height=" + tmpHeight + "px");
}

//æ£æ¥è¾å¥æ¯å¦æ¯æ°å­
function checkcapital(input, flag) {
	if (input.value == "") return false;
	str = input.value;
	var checkOK;
	var checkStr = str;
	var allValid = true;
	var allNum = "";
	if (flag == 0) {
		checkOK = "0123456789-, ";
	} else {
		checkOK = "0123456789";
	}
	for (i = 0; i < checkStr.length; i++) {
		ch = checkStr.charAt(i);
		for (j = 0; j < checkOK.length; j++) {
			if (ch == checkOK.charAt(j)) {
				break;
			}
		}
		if (j == checkOK.length) {
			allValid = false;
			break;
		}
		allNum += ch;
	}
	if (!allValid) {
		alert("è¾å¥çæ°æ®å¿é¡»æ¯æ°å­!");
		input.value = "";
		input.focus();
		input.select();
		return (false);
	}
	return true;
}

//å¼¹åºä¸è¬çªå£
function JsAdd(url, iWidth, iHeight, iTop, iLeft) { 
	open(url, "Detail", "Scrollbars=no,Toolbar=no,Location=no,Direction=no,resizable=yes,Width=" + iWidth + " ,Height=" + iHeight + ",top=" + iTop + ",left=" + iLeft); 
}

//è½¬å¥é¡µäºä»¶
function submitpage(maxPageNum) {
	if (document.getElementById('txtpage').value == "") {
		alert("è¯·è¾å¥è¦æ¥ççé¡µç ï¼");
		document.getElementById('txtpage').focus();
		return false;
	} else {
		ipage = parseInt(document.getElementById('txtpage').value);
		if (isNaN(ipage)) {
			alert("è¯·ç¡®è®¤è¾å¥çæ¯æ°å­!");
			document.getElementById('txtpage').focus();
			return false;
		} else {
			if (ipage < 1) {
				document.Form1.PageNum.value = "1";
				ipage = 1;
			}
			if (ipage > maxPageNum) {
				document.Form1.PageNum.value = maxPageNum;
				ipage = maxPageNum;
			}
			document.Form1.PageNum.value = ipage;
			creating.style.visibility = "visible";
			document.Form1.submit();
			document.getElementById('alldiv').disabled = true;
			return true;
		}
	}
}

//å­æ¥è¡¨çæå¼å³é­äºä»¶ï¼ç¬¬äºä¸ªçæ¬
function openclose2(rowIndex, subTableHeight, url, basePath) {
	var closeimg = basePath + "/framework/images/menu_close.gif";
	var openimg = basePath + "/framework/images/menu_open.gif";
	if (document.getElementById("img" + rowIndex).src.indexOf("close") > 0) {
		document.getElementById("img" + rowIndex).src = openimg;
		if (document.getElementById("subtd" + rowIndex).innerHTML.length <= 6){
		    document.getElementById("subtd" + rowIndex).innerHTML = "<iframe scrolling=no id=\"subiframe" + rowIndex + "\" width=90% height=" + subTableHeight + " src=\"\"></iframe>";
		    document.all("subiframe" + rowIndex).src = url;
		}
		document.all("subtr" + rowIndex).style.display = "block";
	} else {
		document.getElementById("img" + rowIndex).src = closeimg;
		document.all("subtr" + rowIndex).style.display = "none";
	}
}
 function checkRadioEmpty(prop) {
		var radio_len = document.all(prop).length;
		var result = false;
		if(radio_len >= 2) {
			for(var i=0;i<radio_len;i++) {
				 if(document.all(prop)[i].checked == true){
					  result = true;
				 }
			}
		}else{
			if(document.all(prop).checked == true) {
				result = true;
			}
		}
		return result;
	}
    
    
//ç¹å»ä¿å­æé®--å¢å (å¢ä¿®å ç¨)
function submitAdd(action1,callback){
	if(checkType() == false) return;
	var field = document.Form1.fieids.value.split('\|');
	 for(var i=1;i<field.length;i++){
   	 var tmp=field[i].split(',');
   	 //tmp = tmp[0].split('.');
   	 var maxlen = document.getElementById(tmp[0]).maxLength;
   	 
			if(typeof(document.getElementById(tmp[0]).value)!='undefined') {
			   	 if(trimstr(document.getElementById(tmp[0]).value)=="null"){
				       alert('æ­¤ææ¬æ¡çå¼ä¸è½ä¸ºnull');
				       document.all(tmp[0]).focus();
				       document.all(tmp[0]).select();	
				       return false;
			      }
			      var t = document.getElementById(tmp[0]).value;
				  var length = t.replace(/[^\x00-\xff]/g,"**").length
				  if(length!=''){
				  	  if(parseInt(maxlen)<length){
				  		alert('æ­¤ææ¬æ¡çå¼è¿é¿ï¼æå¤åè®¸æ'+maxlen+'ä¸ªå­ç¬¦ï¼å¶ä¸­æ±å­å ä¸¤ä¸ªå­ç¬¦ï¼å¶ä»å ä¸ä¸ªå­ç¬¦');
				  	 	document.all(tmp[0]).focus();
				  	 	return false;
				 	 }
				  }
		    }
    }
    
    var notnul=document.Form1.notNull.value.split(/,/g);
    for(var i=0;i<notnul.length;i++){
    var temp=notnul[i].split(/:/g);
    
    if(notnul[i].indexOf("#radiobox") >= 0) {
    	if(!checkRadioEmpty(temp[1].replace("#radiobox",""))) {
			alert(temp[0]+"æ²¡æéæ©!");
			return false;
		}
    }
    else{
    if (typeof(temp[1]) != "undefined") { 
	    if(trimstr(document.getElementById(temp[1]).value)==""){
		       alert(temp[0]+'ä¸è½ä¸ºç©º');
		       document.getElementById(temp[1]).focus();
		       try{
			        document.getElementById(temp[1]).select();
		       }catch(e){}
		       	    return false;
		       }
	    }
	    }
	    
	   
	    
    }
     //åè°æ¹æ³
	     if(typeof(callback)!='undefined'){
	     if(!callback()){
	     return;
	     }
	       }
    document.Form1.submit_add.disabled="true";
    if(action1=="null"){
	       document.Form1.actionUrl.value="add";
	       //alert(callback);
	       window.Form1.submit();
    }else{
	       window.Form1.action  = action1;
	       window.Form1.submit();
    }
}

//ç¹å»ä¿å­æé®--ä¿®æ¹(å¢ä¿®å ç¨)
function submitEdit(action1,callback){
	if(!isFormChanged()) return;
	
	if(checkType() == false) return;
	var field = document.Form1.fieids.value.split('\|');
	
	for(var i=1;i<field.length;i++){
	   	 var tmp=field[i].split(',');
	   	 //tmp = tmp[0].split('.');
	   	 var maxlen = document.getElementById(tmp[0]).maxLength;
	     if(trimstr(document.getElementById(tmp[0]).value)=="null"){
		       alert('æ­¤ææ¬æ¡çå¼ä¸è½ä¸ºnull');
		       document.all(tmp[0]).focus();
		       document.all(tmp[0]).select();	
		       return false;
	      }
	     var t = document.getElementById(tmp[0]).value;
		 var length = t.replace(/[^\x00-\xff]/g,"**").length
		 if(length!=''){
			if(parseInt(maxlen)<length){
				  alert('æ­¤ææ¬æ¡çå¼è¿é¿ï¼æå¤åè®¸æ'+maxlen+'ä¸ªå­ç¬¦ï¼å¶ä¸­æ±å­å ä¸¤ä¸ªå­ç¬¦ï¼å¶ä»å ä¸ä¸ªå­ç¬¦');
				  document.all(tmp[0]).focus();
				  return false; 
			}
		 }
    }
 	var notnul=document.Form1.notNull.value.split(/,/g);
     //å´äºä¿®æ¹
    for(var i=0;i<notnul.length;i++){
	   	 var temp = notnul[i].split(/:/g);
	   	 
	   	 if(notnul[i].indexOf("#radiobox") >= 0) {
	    	if(!checkRadioEmpty(temp[1].replace("#radiobox",""))) {
				alert(temp[0]+"æ²¡æéæ©!");
				return false;
			}
	    }
	    else{
		   	 if(trimstr(document.getElementById(temp[1]).value)==""){
		    	alert(temp[0]+'ä¸è½ä¸ºç©º');
		       	//temp[1].fouce();
		       	//temp[1].select();
		       	return false;
		   	 }
	   	}
	   	 
    }
    
     //åè°æ¹æ³
	     if(typeof(callback)!='undefined'){
	     if(!callback()){
	     return;
	     }
	       }
    
    document.Form1.submit_add.disabled="true";
    document.Form1.loadTimes.value=1;
    if(action1=="null"){
     	  document.Form1.actionUrl.value="edit";
      	 window.Form1.submit();
    }else{
     	  window.Form1.action = action1;
     	  window.Form1.submit();
    }
}
//ç¹å»å é¤æé®--å é¤(å¢ä¿®å ç¨)
function submitDel(action1){
   if(!confirm('æ°æ®å°è¢«å é¤,æ¯å¦ç»§ç»­?'))
     {return false;}
    document.Form1.delButton.disabled="true";
    document.Form1.loadTimes.value=1;
    if(action1=="null"){
       document.Form1.actionUrl.value="del";
       window.Form1.submit();
    }else{
       window.Form1.action= action1;
       window.Form1.submit();
    }
}

//æ¥è¯¢äºä»¶
function JsFind(htmlurl,tmpWidth,tmpHeight){
	var newwin = window.showModalDialog(htmlurl,"","dialogWidth:"+tmpWidth+"px;status:no;dialogHeight:"+tmpHeight+"px");
	if (newwin != null)
	{
		if (newwin.type == "ok")
		{
			window.Form1.where1.value = newwin.wheresql;
			window.Form1.OrderBy.value = newwin.OrderBy;
			window.Form1.PageNum.value = "1";
			creating.style.visibility='visible';
			window.Form1.submit();
			document.getElementById('alldiv').disabled = true;
		}
	}
}

function getRandomStr()
{
	var  date=new Date();
	var t=Date.parse(date);   
	return t;
}

//ç»URLå¸¦ä¸ªéæºåæ°
function getRandomUrl(htmlurl)
{
var count =htmlurl.indexOf("?");
var  date=new Date();
var t=Date.parse(date);    
if(count<0)
{
htmlurl=htmlurl+"?tktime="+t;
}
else
{
htmlurl=htmlurl+"&tktime="+t;
}

return htmlurl;
}

//å¢å äºä»¶
function JsMAdd(htmlurl,tmpWidth,tmpHeight){
    htmlurl=getRandomUrl(htmlurl);
    var newwin = window.showModalDialog(htmlurl,window,"dialogWidth:"+tmpWidth+"px;status:no;dialogHeight:"+tmpHeight+"px");	
	if (newwin == null){
		//creating.style.visibility='visible';
		//window.Form1.PlAction.value="";
		//window.Form1.submit();
		//document.getElementById('alldiv').disabled = true;
	}else if (newwin == "ok"){
		if (confirm("æ¯å¦åæ¬¡å¢å è®°å½ï¼")){
			JsMAdd(htmlurl,tmpWidth,tmpHeight);
		}else{
			creating.style.visibility='visible';
			window.Form1.PlAction.value="";
			window.Form1.submit();
			document.getElementById('alldiv').disabled = true;
		}
	}else{
		window.Form1.submit();
	}
}
//å¢å äºä»¶
function JsMAddbyNoRefresh(htmlurl,tmpWidth,tmpHeight){
	var newwin = window.showModalDialog(htmlurl,window,"dialogWidth:"+tmpWidth+"px;status:no;dialogHeight:"+tmpHeight+"px");	
}

//æ¾ç¤º\éèè¡¨æ ¼
function showTable(imgId, divId) {
    var tableDivObj = document.getElementById(divId);
    tableDivObj.style.display = (tableDivObj.style.display == "none" ? "block" : "none");
} 

//å¤æ­èº«ä»½è¯æ ¼å¼
function checkIdCard(obj) {
	if (obj.value == "") return false;
	var factorArr = new Array(7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2, 1);
	var error;
	var varArray = new Array();
	var intValue;
	var lngProduct = 0;
	var intCheckDigit;
	var idNumber = obj.value;
	var intStrLen = obj.value.length;
	if ((intStrLen != 15) && (intStrLen != 18)) {
		error = "è¾å¥èº«ä»½è¯å·ç é¿åº¦ä¸æ­£ç¡®ï¼"; 
		alert(error);
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	for (i = 0; i < intStrLen; i++) {
		varArray[i] = idNumber.charAt(i);
		if ((varArray[i] < "0" || varArray[i] > "9") && (i != 17)) {
			error = "éè¯¯çèº«ä»½è¯å·ç ï¼"; 
			alert(error);
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		} else {
			if (i < 17) {
				varArray[i] = varArray[i] * factorArr[i];
			}
		}
	}
	if (intStrLen == 18) {
		var date8 = idNumber.substring(6, 14);
		if (checkDateId(date8) == false) {
			error = "èº«ä»½è¯ä¸­æ¥æä¿¡æ¯ä¸æ­£ç¡®ï¼"; 
			alert(error);
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		}
		for (i = 0; i < 17; i++) {
			lngProduct = lngProduct + varArray[i];
		}
		intCheckDigit = 12 - lngProduct % 11;
		switch (intCheckDigit) {
		  case 10:
			intCheckDigit = "X";
			break;
		  case 11:
			intCheckDigit = 0;
			break;
		  case 12:
			intCheckDigit = 1;
			break;
		}
		if (varArray[17].toUpperCase() != intCheckDigit) {
			error = "èº«ä»½è¯æéªä½éè¯¯!...æ­£ç¡®ä¸ºï¼ " + intCheckDigit + "";
			alert(error);
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		}
	} else {
		var date6 = idNumber.substring(6, 12);
		if (checkDateId(date6) == false) {
			alert("èº«ä»½è¯æ¥æä¿¡æ¯æè¯¯ï¼");
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		}
	}
	return true;
}

function checkDateId(date){    
	return true;
}

//å¤æ­æ¥ææ ¼å¼
function CheckDate(obj) {
	var sDate = obj.value;
	var iaMonthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	var iaDate = new Array(3);
	var year, month, day;
	if (arguments.length != 1) {
		alert("ç¨åºéè°ç¨çåæ°æéï¼\nåªè½ä¸ä¸ªåæ°ï¼");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	iaDate = sDate.toString().split("-");
	if (obj.value != "") {
		if (iaDate.length != 3) {
			alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼2000-01-01");
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		}
		if (iaDate[1].length > 2 || iaDate[2].length > 2) {
			alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼2000-01-01");
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		}
		year = parseFloat(iaDate[0]);
		month = parseFloat(iaDate[1]);
		day = parseFloat(iaDate[2]);
		if (((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0)) {
			iaMonthDays[1] = 29;
		}
		if (month < 1 || month > 12) {
			alert("æä»½éè¯¯ï¼æä»½èå´åºå¨1-12ä¹é´!");
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		}
		if (day < 1 || day > iaMonthDays[month - 1]) {
			alert("æ¥æéè¯¯ï¼æ¥æèå´åºå¨1-" + iaMonthDays[month - 1] + "ä¹é´");
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		}
		var reg = /^\d{4}-((0[1-9]{1})|([1-9]{1})|(1[0-2]{1}))-((0[1-9]{1})|([1-9]{1})|([1-2]{1}[0-9]{1})|(3[0-1]{1}))$/;
		if (!reg.test(obj.value)) {
			alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼2000-01-01");
			obj.value = "";
			obj.focus();
			obj.select();
			return false;
		}
	}
}
//å¤æ­æ¯å¦ä¸ºæ°å­
function checkNumber(input)
{
try  
  { if(isValidate){return true;}
}catch(err)  
{}
  str = input.value;
  var allValid = true;
  if(str==""){return false;}
  try
  {
	if(parseFloat(str)!=str) allValid = false;
  }
  catch(ex)
  {
	allValid = false;
  }
  if(!allValid){
	alert("è¾å¥çæ°æ®å¿é¡»æ¯æ°å­");
	input.value="";
	input.focus();
	return false;
  }
  return true;
}
//å¤æ­æ¯å¦ä¸ºæ°å­
function checkNumbers(input)
{
  str = input.value;
  var allValid = true;
  if(str==""){return false;}
  try
  {
	if(parseFloat(str)!=str) allValid = false;
  }
  catch(ex)
  {
	allValid = false;
  }
  if(str > 1000){
	alert("è¾å¥çæ°å­å¿éå°äº1000");
	input.value="";
	input.focus();
	return false;
	}
  if(!allValid){
	alert("è¾å¥çæ°æ®å¿é¡»æ¯æ°å­");
	input.value="";
	input.focus();
	return false;
  }
  return true;
}
//å¤æ­æ¯å¦ä¸ºæ´æ°
function checkInteger(input){
	str = input.value;
  	var allValid = true;
  	if(str==""){return false;}
 	try{
		if(parseInt(str)!=str) allValid = false;
  	} catch(ex){
		allValid = false;
	}
	if(!allValid){
		alert("è¾å¥çæ°æ®å¿é¡»æ¯æ°å­");
		input.value="";
		input.focus();
		return false;
  	}
  	return true;
}

//å¤æ­æ¯å¦æ¯å­ç¬¦ææ°å­
function checkLetter(input){
	if (input.value == "") return false;
	if(/[^0-9a-zA-Z]/g.test(input.value)){
		alert("å¿é¡»è¾å¥å­ç¬¦ææ°å­");
		input.value="";
		input.focus();
		return false;
	}
	return true;
}
//å»é¤å­ç¬¦ä¸²ç©ºæ ¼
function trim(input){
	return input.replace(/^\s+/g,"").replace(/\s+$/g,"");
}
//å¤æ­å¹´æèæ¬å½æ°yyyyMM
function checkYearMonth(input){
	if (input.value == "") return false;
	if(trim(input.value) != ""){
		var reg = /^\d{4}(0[1-9]{1})|(1[0-2]{1})$/;
		if(!reg.test(input.value) || input.value.length != 6){
			alert("æ ¼å¼éè¯¯,æ­£ç¡®æ ¼å¼ä¸º200701");
			input.value = "";
			input.focus();
			return false;
		}
	}
	return true;
}

/////////////////////////////////////////////////////æ¹éæä½éæ©å¼¹åºiframe
function ChooseHiddenframe(basePath){
	var tmpWidth = 200;
	var tmpHeight = 200;
	var tmpUrl = basePath;
	var ChooseType="";
	if(document.all.isOutJoin.value=='false')
		ChooseType= document.all.ZdSzNr.value.substring(document.all.ZdSzNr.value.lastIndexOf(":")+1);
	else
		ChooseType = document.all.ZdSzNr.value.substring(0,document.all.ZdSzNr.value.indexOf(":"))+"::"+document.all.ZdSzNr.value.substring(document.all.ZdSzNr.value.lastIndexOf(":")+1);
	switch(ChooseType){
	  case "gymc":		//å¬å¯ä¿¡æ¯
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "fjzfbz":		//èµè´¹æ å
	    tmpWidth = "340";
	    tmpHeight = "300";
	    break;
	  case "xbmb":		//æ§å«ç¼ç 
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "lxtjsm":		//ç¦»æ ¡æ¡ä»¶
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "xn":		//å­¦å¹´
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "xq":   //å­¦æ
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "jllbmc":		//å¥å±ç±»å«
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "fxqmc":		//åæ ¡åºåç§°
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "gyqmc":		//å¬å¯åºåç§°
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;  
	  case "lcbh":     //æ¥¼å±
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "fjbh":    //æ¿é´
	  	tmpWidth = "450";
	    tmpHeight = "400";
	    break;
	  case "wpsm":   //ç©å
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "jgxm":   //åè®­æå®
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "cdmc":   //åè®­åºå°
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "jxxmmc":   //åè®­é¡¹ç®
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "jxmc":   //åè®­åç§°
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "tzbzxmmc":   //ä½å¶å¥åº·æ åé¡¹ç®
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	  case "zhcpxmmc":   //ç»¼åæµè¯é¡¹ç®
	    tmpWidth = "320";
	    tmpHeight = "300";
	    break;
	}
    tmpUrl = tmpUrl+ "/selectDictionary.do?method=execute&isOutJoin="+document.all.isOutJoin.value+"&type=" + ChooseType;
	var abe=getLTWH(document.getElementById('ZdSzValue'));
	document.getElementById("hiddenframe").style.position = "absolute";
    document.getElementById("hiddenframe").style.border = 0;
	document.getElementById("hiddenframe").width = tmpWidth;
	document.getElementById("hiddenframe").height = tmpHeight;
    document.getElementById("hiddenframe").style.pixelLeft = abe.left;
	document.getElementById("hiddenframe").style.top = abe.top - tmpHeight - 2;
	document.getElementById("hiddenframe").style.display = "";
	window.frames["hiddenframe"].location = tmpUrl;	
}

/// æ¾åºåç´ å¨é¡µé¢ä¸­çåæ åé«åº¦,å®½åº¦
///element  é¡µé¢åç´ 
/// <returns>è¿ååç´ çç»å¯¹Left,Top,Width,Heihgt</returns>
function getLTWH(element) { 
    if ( arguments.length != 1 || element == null )  { 
        return null; 
    } 
    var offsetTop = element.offsetTop; 
    var offsetLeft = element.offsetLeft; 
    var offsetWidth = element.offsetWidth; 
    var offsetHeight = element.offsetHeight; 
    while( element = element.offsetParent ) { 
        offsetTop += element.offsetTop; 
        offsetLeft += element.offsetLeft; 
    } 
    var Abe={
       left:offsetLeft,
       top:offsetTop,
       width:offsetWidth,
       height:offsetHeight
    }
    return Abe;
} 
///////////////éæ©æé®å¼¹åºiframe
function selectFrame(dmField,mcField,ChooseType)
{
	var tmpWidth = "";
	var tmpHeight = "";
	var tmpUrl = "";
	var tmpChooseType = ChooseType;
	var tmpRight = "";
	var strhql="";
	switch(tmpChooseType.toLowerCase())
	{
	   case "bzkzy":		     //éæ©é¨é¢ä¸ä¸
			tmpWidth = "255";
			tmpHeight = "262";
			break;
	}
    tmpUrl = "../ggxx/selectFrame.do?method=select&type=" + tmpChooseType;
	var abe=getLTWH(document.getElementById(mcField));
	document.getElementById("hiddenframe").style.position = "absolute";
	document.getElementById("hiddenframe").style.border="0px ";
	document.getElementById("hiddenframe").width = tmpWidth;
	document.getElementById("hiddenframe").height = tmpHeight;
	document.getElementById("hiddenframe").style.pixelLeft = abe.left;
	document.getElementById("hiddenframe").style.top = abe.top+abe.height;
	document.getElementById("hiddenframe").style.display = "";
	window.frames["hiddenframe"].location = tmpUrl+"&dmField="+dmField+"&mcField="+mcField+"";	
}

//å¤æ­æ¥ææ ¼å¼2 yyyyMMdd
function CheckDate2(obj) {
	if (obj.value == "") return false;
	var sDate = obj.value;
	var iaMonthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	var iaDate = new Array(3);
	if (sDate.length != 8) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼20080101");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	iaDate[0] = sDate.substring(0, 4);
	iaDate[1] = sDate.substring(4, 6);
	iaDate[2] = sDate.substring(6, 8);
	var year, month, day;
	if (arguments.length != 1) {
		alert("ç¨åºéè°ç¨çåæ°æéï¼\nåªè½ä¼ å¥1ä¸ªåæ°ï¼");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	if (iaDate[1].length > 2 || iaDate[2].length > 2) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼20080101");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	year = parseFloat(iaDate[0]);
	if (sDate.substring(4, 5) != "0") {
		month = parseFloat(iaDate[1]);
	} else {
		month = parseFloat(sDate.substring(5, 6));
	}
	if (sDate.substring(6, 7) != "0") {
		day = parseFloat(iaDate[2]);
	} else {
		day = parseFloat(sDate.substring(7, 8));
	}
	if (((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0)) {
		iaMonthDays[1] = 29;
	}
	if (month < 1 || month > 12) {
		alert("æä»½éè¯¯ï¼æä»½èå´åºå¨1-12ä¹é´!");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	if (day < 1 || day > iaMonthDays[month - 1]) {
		alert("æ¥æéè¯¯ï¼æ¥æèå´åºå¨" + iaMonthDays[month - 1] + "ä¹é´");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	var reg = /^\d{4}((0[1-9]{1})|([1-9]{1})|(1[0-2]{1}))((0[1-9]{1})|([1-9]{1})|([1-2]{1}[0-9]{1})|(3[0-1]{1}))$/;
	if (!reg.test(obj.value)) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼20080101");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	return true;
}
//å¤æ­æ¥ææ ¼å¼2 yyyyMMdd
//åæ°flagæ¯å¦éè¦å¤æ­æªæ­¢æ¥æå¤§äºå¼å§æ¥æ
function CheckDateAndValidate(qsrq,jzrq) {
	if (jzrq.value == "") return false;
	var sDate = jzrq.value;
	var iaMonthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	var iaDate = new Array(3);
	if (sDate.length != 8) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼20080101");
		jzrq.value = "";
		jzrq.focus();
		jzrq.select();
		return false;
	}
	iaDate[0] = sDate.substring(0, 4);
	iaDate[1] = sDate.substring(4, 6);
	iaDate[2] = sDate.substring(6, 8);
	var year, month, day;
	if (iaDate[1].length > 2 || iaDate[2].length > 2) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼20080101");
		jzrq.value = "";
		jzrq.focus();
		jzrq.select();
		return false;
	}
	year = parseFloat(iaDate[0]);
	if (sDate.substring(4, 5) != "0") {
		month = parseFloat(iaDate[1]);
	} else {
		month = parseFloat(sDate.substring(5, 6));
	}
	if (sDate.substring(6, 7) != "0") {
		day = parseFloat(iaDate[2]);
	} else {
		day = parseFloat(sDate.substring(7, 8));
	}
	if (((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0)) {
		iaMonthDays[1] = 29;
	}
	if (month < 1 || month > 12) {
		alert("æä»½éè¯¯ï¼æä»½èå´åºå¨1-12ä¹é´!");
		jzrq.value = "";
		jzrq.focus();
		jzrq.select();
		return false;
	}
	if (day < 1 || day > iaMonthDays[month - 1]) {
		alert("æ¥æéè¯¯ï¼æ¥æèå´åºå¨" + iaMonthDays[month - 1] + "ä¹é´");
		jzrq.value = "";
		jzrq.focus();
		jzrq.select();
		return false;
	}
	var reg = /^\d{4}((0[1-9]{1})|([1-9]{1})|(1[0-2]{1}))((0[1-9]{1})|([1-9]{1})|([1-2]{1}[0-9]{1})|(3[0-1]{1}))$/;
	if (!reg.test(jzrq.value)) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼20080101");
		jzrq.value = "";
		jzrq.focus();
		jzrq.select();
		return false;
	}
	checkDataIsValid(qsrq,jzrq);
}
//å¤æ­æªæ­¢æ¥æå¿é¡»å¤§äºå¼å§æ¥æ
function checkDataIsValid(qsrq,jzrq){
		var qsdata = new Array(3);
		var jzdata = new Array(3);
		qsdata[0] = qsrq.value.substring(0, 4);
		qsdata[1] = qsrq.value.substring(4, 6);
		qsdata[2] = qsrq.value.substring(6, 8);
		if(null!=jzrq.value && ""!=jzrq.value){
			jzdata[0] = jzrq.value.substring(0, 4);
			jzdata[1] = jzrq.value.substring(4, 6);
			jzdata[2] = jzrq.value.substring(6, 8);
			if(qsdata[0]>jzdata[0]){
				alert("æªæ­¢æ¥æä¸è½å°äºèµ·å§æ¥æ!");
				jzrq.focus();
				jzrq.select();
				return false;
			}else if(qsdata[0]==jzdata[0]){
				if(qsdata[1]>jzdata[1]){
					alert("æªæ­¢æ¥æä¸è½å°äºèµ·å§æ¥æ!");
					jzrq.focus();
					jzrq.select();
					return false;
				}else if(qsdata[1]==jzdata[1]){
					if(qsdata[2]>jzdata[2]){
						alert("æªæ­¢æ¥æä¸è½å°äºèµ·å§æ¥æ!");
						jzrq.focus();
						jzrq.select();
						return false;
					}else if(qsdata[2]==jzdata[2]){
						if(qsdata[3]>=jzdata[3]){
							alert("æªæ­¢æ¥æä¸è½å°äºèµ·å§æ¥æ!");
							jzrq.focus();
							jzrq.select();
							return false;
						}
					}
				}
				return true;
			}
		}
		return true;
	}
//å¤æ­å¹´ä»½yyyy
function CheckYear(obj){
	if (arguments.length != 1) {
		alert("ç¨åºéè°ç¨çåæ°æéï¼\nåªè½ä¼ å¥1ä¸ªåæ°ï¼");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	if (obj.value == "") return false;
	if (obj.value.length != 4) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼2008");
		obj.value = "";
		obj.focus();
		obj.select();
		
		return false;
	}
	var reg=new RegExp("^\\d{4}$");
	if(!reg.test(obj.value)){
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼2008");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	var year = parseFloat(obj.value);
	if (year < 1970 || year > 2050){
		alert("å¹´ä»½è¾å¥éè¯¯!");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
}

//å¤æ­æ¥ææ ¼å¼3 yyyyMM
function CheckDate3(obj) {
	if (arguments.length != 1) {
		alert("ç¨åºéè°ç¨çåæ°æéï¼\nåªè½ä¼ å¥1ä¸ªåæ°ï¼");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	if (obj.value == "") return false;
	var sDate = obj.value;
	var iaDate = new Array(2);
	if (sDate.length != 6) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼200801");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	var reg =  /^(\d{4})(\d{2})$/;
	if (!reg.test(obj.value)) {
		alert("æ¥ææ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼200801");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	iaDate[0] = sDate.substring(0, 4);
	iaDate[1] = sDate.substring(4, 6);
	var year, month;
	year = parseFloat(iaDate[0]);
	if (year < 1970 || year > 2050){
		alert("å¹´ä»½è¾å¥éè¯¯!");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	if (sDate.substring(4, 5) != "0") {
		month = parseFloat(iaDate[1]);
	} else {
		month = parseFloat(sDate.substring(5, 6));
	}
	if (month < 1 || month > 12) {
		alert("æä»½éè¯¯ï¼æä»½èå´åºå¨1-12ä¹é´!");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	return true;
}


//éªè¯EMAILæ ¼å¼
function ValidateEmail(obj){
	if (obj.value == "") return false;
    var emailReg=/^([a-zA-Z0-9_\-\.\+]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9\-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
    if (!emailReg.test(obj.value)) {
		alert("emailæ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼admin@qzsoft.com");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	return true;
}
//è®¾ç½®cookieï¼é»è®¤ä¿æ30å¤©
function setCookie(name, value) {
	var Days = 30;
	var exp = new Date(); 
	exp.setTime(exp.getTime() + Days * 24 * 60 * 60 * 1000);
	//document.cookie = name + "=" + escape(value) + ";expires=" + exp.toGMTString();
}
//è·åcookie
function getCookie(name) {
	//var arr = document.cookie.match(new RegExp("(^|   )" + name + "=([^;]*)(;|$)"));
	var arr = document.cookie.split(";");
	if (arr != null) {
		for(var i=0;i<arr.length;i++) {
			var theTmp = arr[i].split("=");
			if(name == trimstr(theTmp[0])) 
				return unescape(theTmp[1]);
		}
	}
	return "";
}
//å é¤ä¸ä¸ªcookie
function delCookie(name) {
	var exp = new Date();
	exp.setTime(exp.getTime() - 1);
	var cval = getCookie(name);
	if (cval != null) {
		//document.cookie = name + "=" + cval + ";expires=" + exp.toGMTString();
	}
}
//éªè¯ä¸ä¸ªå°åæ¯å¦æ¯IPå°å
function isIPa(obj) { 
	if (obj.value == "") return false;
	var re=/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/g 
	if(re.test(obj.value)){ 
		if( RegExp.$1 <256 && RegExp.$2<256 && RegExp.$3<256 && RegExp.$4<256) return true; 
	}
	alert("IPå°åæ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ï¼192.168.1.1");
	obj.value = "";
	obj.focus();
	obj.select();
	return false; 
}
//æ¥ææ¶é´æ£æ¥  
//æ ¼å¼ä¸ºï¼YYYY-MM-DD HH:MM:SS  
function CheckDateTime(obj){
	if (obj.value == "") return false;
    var reg = /^(\d+)-(\d{1,2})-(\d{1,2}) (\d{1,2}):(\d{1,2}):(\d{1,2})$/; 
    var reg1 = /^(\d+)-(\d{1,2})-(\d{1,2})$/; 
    var r = obj.value.match(reg); 
    var r1 = obj.value.match(reg1);
    if(r==null&&r1!=null){
    	obj.value = obj.value+" 00:00:00";
    }
    r = obj.value.match(reg); 
    if(r==null){
    	alert("æ¥ææ¶é´æ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ä¸ºï¼yyyy-MM-dd hh:mm:ss");
		obj.value = "";
		obj.focus();
		obj.select();
    	return false;
    }
    r[2]=r[2]-1;   
    var d= new Date(r[1],r[2],r[3],r[4],r[5],r[6]);
    if(d.getFullYear()!=r[1] || d.getMonth()!=r[2] 
    	|| d.getDate()!=r[3] || d.getHours()!=r[4] 
    	|| d.getMinutes()!=r[5] || d.getSeconds()!=r[6]){
    	alert("æ¥ææ¶é´æ ¼å¼éè¯¯ï¼æ­£ç¡®æ ¼å¼ä¸ºï¼yyyy-MM-dd hh:mm:ss");
		obj.value = "";
		obj.focus();
		obj.select();
    	return false;
    }
    return true;   
}

//è·³è½¬å°ä½ æå®çPATH
function GoYourPath(path){
	window.location.href = path;
}

//å¤æ­æ¯å¦ä¸ºæ°å­åæ­£æ° 
function checkNumberIsTun(input)
{
  str = input.value;
  var allValid = true;
  
    if(str==""){return false;}
    
    if( str.substr(0,1) =="0" &&  str.substr(1,1)!=".")
	{
	  alert("è¾å¥æ ¼å¼éè¯¯ï¼");
	  input.value="";
	  input.focus();
	  return false;
	}
	
	try
	 {
		if(parseFloat(str,10)!=str) allValid = false;
	 }
	 catch(ex)
	 {
		allValid = false;
	 }
  if(!allValid){
	alert("è¾å¥çæ°æ®å¿é¡»æ¯æ°å­!");
	input.value="";
	input.focus();
	return false;
  }
  else if(eval(str) <= 0)
  {
  	alert("è¾å¥çæ°æ®å¿é¡»å¤§äºé¶!");
  	input.value="";
	input.focus();
	return false;
  }
  else if(eval(str) > 9999999999.99)
  {
	alert("æ°æ®è¿å¤§,å¿é¡»å°äºç¾äº¿!");
	input.value="";
	input.focus();
	return false;
  }
    return true;
}
//å¤æ­æ¯å¦ä¸ºæ°å­åæ­£æ° 
function checkNumberIsTuns(input)
{
  str = input.value;
  var allValid = true;
  
    if(str==""){return false;}
    
     
	try
	 {
		if(parseFloat(str,10)!=str) allValid = false;
	 }
	 catch(ex)
	 {
		allValid = false;
	 }
  if(!allValid){
	alert("è¾å¥çæ°æ®å¿é¡»æ¯æ°å­!");
	input.value="";
	input.focus();
	return false;
  }
  else if(eval(str) < 0)
  {
  	alert("è¾å¥çæ°æ®å¿é¡»å¤§äºé¶!");
  	input.value="";
	input.focus();
	return false;
  }
  else if(eval(str) > 9999999999.99)
  {
	alert("æ°æ®è¿å¤§,å¿é¡»å°äºç¾äº¿!");
	input.value="";
	input.focus();
	return false;
  }
    return true;
}
//å¤æ­æ¯å¦ä¸ºæ´æ°åæ­£æ°
function checkIntegerIsTun(input)
{
	str = input.value;
  	var allValid = true;
  	if(str==""){return false;}
 	try{
		if(parseInt(str,10)!=str) allValid = false;
  	} 
  	catch(ex)
  	{
		allValid = false;
	}
	if(!allValid){
		alert("è¾å¥çæ°æ®å¿é¡»æ¯æ´æ°!");
		input.value="";
		input.focus();
		return false;
  	}
  	else if(str <= 0)
    {
      alert("è¾å¥çæ°æ®å¿é¡»å¤§äºé¶!");
  	  input.value="";
	  input.focus();
	  return false;
    }
    else if(eval(str) > 99999999)
  	{
	  alert("æ°æ®è¿å¤§,å¿é¡»å°äºäº¿!");
	  input.value="";
	  input.focus();
	  return false;
  	}
  	return true;
}

//å¤æ­æ¯å¦ä¸ºæ°å­åæ­£æ°
function checkNumberIsMoney(input)
{
  str = input.value;
  var allValid = true;
  if(str==""){return false;}
  
    if( str.substr(0,1) =="0" &&  str.substr(1,1)!=".")
	{
	  alert("è¾å¥æ ¼å¼éè¯¯ï¼");
	  input.value="";
	  input.focus();
	  return false;
	}
	try
	 {
		if(parseFloat(str,10)!=str) allValid = false;
	 }
	 catch(ex)
	 {
		allValid = false;
	 }
	 
  if(!allValid){
	alert("è¾å¥çæ°æ®å¿é¡»æ¯æ°å­!");
	input.value="";
	input.focus();
	return false;
  }
  else if(eval(str) <= 0)
  {
  	alert("è¾å¥çæ°æ®å¿é¡»å¤§äºé¶!");
  	input.value="";
	input.focus();
	return false;
  }
  else if(eval(str) > 999999989999999999.99)
  {
	alert("æ°æ®è¿å¤§!");
	input.value="";
	input.focus();
	return false;
  }
    return true;
}
/****************************************************************************
* è°¢å¹³20080924å¢å ä¸ç³»åæ£æ¥JSæ¹æ³
****************************************************************************/
//éè¿idè·å¾è¿ä¸ªå¯¹è±¡çå¼
function getValue(idOrName) {
	return document.getElementById(idOrName).value;
}
//éè¿idè·å¾å¯¹è±¡
function getObj(idOrName) {
	return document.getElementById(idOrName);
}

//æ£æ¥è¾å¥å¯¹è±¡æ¯å¦ä¸ºç©º
function isEmpty(s) {
	var bool = false;
	if (s == null || trimstr(s) == "")
		bool = true;
	return bool;
}

//æ£æ¥ç¨æ·è¾å¥å­æ®µæ¯å¦è¶è¿æå®é¿åº¦
function checkInputValueLength(inStr, length) {
	if ((inStr == null) || (trimstr(inStr) == "")) {
		return true;
	}
	if (inStr.length > length) {
		return true;
	}
	return false;
}

//æ£æ¥ç¨æ·è¾å¥å­æ®µé¿åº¦å¨ä¸¤ä¸ªæ°ä¹é´
function checkInputBetween(inStr, limitLen, maxLen) {
	if ((inStr == null) || (trimstr(inStr) == "")) {
		return false;
	}
	if ((inStr.length < limitLen) || (inStr.length > maxLen)) {
		return true;
	}
	return false;
}

//å°æ¥ä¸¤ä¸ªå­ç¬¦ä¸²æ¯å¦ç¸ç­
function checkTwoString(str1, str2) {
	return (str1 == str2);
}

//è¿æ»¤æå­ç¬¦ä¸² sString ä¸­çç©ºæ ¼ï¼è¿åè¿æ»¤åçå­ç¬¦ä¸²
function tFilterSpace(sString) {
	var re;
	re = / /g;
	return sString.replace(re, "");
}

//æ£æ¥å­ç¬¦ä¸²1(findval)å¨å­ç¬¦ä¸²2(val)ä¸­åºç°çæ¬¡æ°
function stringAppearCount(findval, val) {
	var v1 = 0;
	var v2 = 0;
	while (v1 != -1 && v1 < val.length) {
		v1 = val.indexOf(findval, v1);
		if (v1 >= 0) {
			v1++;
			v2++;
		}
	}
	return v2;
}

//æ£æ¥å­ç¬¦ä¸²1(findval)å¨å­ç¬¦ä¸²2(val)ä¸­åºç°ç¬¬å æ¬¡(val3)æ¶çä½ç½®
function stringAppearPlace(findval, val, val3) {
	var v1 = 0;
	while (val3 > 0 && v1 != -1 && v1 < val.length) {
		v1 = val.indexOf(findval, v1);
		if (v1 >= 0) {
			v1 = v1 + findval.length;
			val3--;
		}
	}
	if (v1 > 0) {
		v1 = v1 - findval.length();
	}
	return v1;
}
//æ£æ¥å­ç¬¦ä¸²é¿åº¦æ¯å¦ç¬¦åè¦æ±
function stringCheckLength(val, val3) {
		if (val.length > val3) {
			alert("è¾å¥é¿åº¦å¤§äº"+val3);
			return false;
		}
}
//å­ç¬¦è½¬æ¢ä¸ºUTF-8ç¼ç 
function EncodeUtf8(s1)
{
      var s = escape(s1);
      var sa = s.split("%");
      var retV ="";
      if(sa[0] != "")
      {
         retV = sa[0];
      }
      for(var i = 1; i < sa.length; i ++)
      {
           if(sa[i].substring(0,1) == "u")
           {
               retV += Hex2Utf8(Str2Hex(sa[i].substring(1,5)));
              
           }
           else retV += "%" + sa[i];

		   if (sa[i].length > 5)
		   {
		      retV += sa[i].substring(5);
		   } 
		   
		   
      }
     
      return retV;
}
function Str2Hex(s)
{
      var c = "";
      var n;
      var ss = "0123456789ABCDEF";
      var digS = "";
      for(var i = 0; i < s.length; i ++)
      {
         c = s.charAt(i);
         n = ss.indexOf(c);
         digS += Dec2Dig(eval(n));
          
      }
      //return value;
      return digS;
}
function Dec2Dig(n1)
{
      var s = "";
      var n2 = 0;
      for(var i = 0; i < 4; i++)
      {
         n2 = Math.pow(2,3 - i);
         if(n1 >= n2)
         {
            s += '1';
            n1 = n1 - n2;
          }
         else
          s += '0';
         
      }
      return s;
     
}
function Dig2Dec(s)
{
      var retV = 0;
      if(s.length == 4)
      {
          for(var i = 0; i < 4; i ++)
          {
              retV += eval(s.charAt(i)) * Math.pow(2, 3 - i);
          }
          return retV;
      }
      return -1;
}
function Hex2Utf8(s)
{
     var retS = "";
     var tempS = "";
     var ss = "";
     if(s.length == 16)
     {
         tempS = "1110" + s.substring(0, 4);
         tempS += "10" + s.substring(4, 10);
         tempS += "10" + s.substring(10,16);
         var sss = "0123456789ABCDEF";
         for(var i = 0; i < 3; i ++)
         {
            retS += "%";
            ss = tempS.substring(i * 8, (eval(i)+1)*8);
           
           
           
            retS += sss.charAt(Dig2Dec(ss.substring(0,4)));
            retS += sss.charAt(Dig2Dec(ss.substring(4,8)));
         }
         return retS;
     }
     return "";
} 


function createTableSetDiv()
{
	var s_array_newtitle = "";
	var s_array_newmc = "";
	var s_array_title = "";
	var s_array_mc = "";
	var _s_array_newtitle = "";
	var _s_array_newmc = "";
	var _s_array_title = "";
	var _s_array_mc = "";
	var _tableFields = document.getElementById("tableFields").value.split(/,/g);
	var _otherFields = document.getElementById("otherFields").value.split(/,/g);
	
	for(var i=0;i<_tableFields.length;i++) {
		_s_array_newtitle = _s_array_newtitle + "," + _tableFields[i].substring(0,_tableFields[i].indexOf(":"));
		_s_array_newmc = _s_array_newmc + "," + _tableFields[i];
	}
	for(var i=0;i<_otherFields.length;i++) {
		_s_array_title = _s_array_title + "," + _otherFields[i].substring(0,_otherFields[i].indexOf(":"));
		_s_array_mc = _s_array_mc + "," + _otherFields[i];
	}
	_s_array_newtitle = _s_array_newtitle.replace(",","");
	_s_array_newmc = _s_array_newmc.replace(",","");
	_s_array_title = _s_array_title.replace(",","");
	_s_array_mc = _s_array_mc.replace(",","");
	s_array_newtitle = _s_array_newtitle.split(/,/g);
	s_array_newmc = _s_array_newmc.split(/,/g);
	s_array_title = _s_array_title.split(/,/g);
	s_array_mc = _s_array_mc.split(/,/g);
	
	var tmpoptions = "";
	var tblhtml = "<table border=\"0\" width=\"100%\"  bordercolorlight=\"#cccccc\" cellspacing=\"0\" cellpadding=\"0\" bordercolor=\"#cccccc\" bordercolordark=\"#FFFFFF\">";
	tblhtml = tblhtml + "<tr><td width=\"45%\" align=\"center\">å¾æ¾ç¤ºå­æ®µ</td><td>&nbsp;</td><td width=\"45%\" align=\"center\">å·²æ¾ç¤ºå­æ®µ</td></tr>";
	tblhtml = tblhtml + "<tr align=\"center\">";
	
	for(i=0;i<s_array_title.length;i++)
	{
		if(s_array_title[i] != "")
			tmpoptions = tmpoptions + "<option value=\""+s_array_mc[i]+"\">"+s_array_title[i]+"</option>";
	}		
	tblhtml = tblhtml + "<td><select name=\"dShowField\"  id=\"dShowField\"  size=\"15\" style=\"width:150\" >"+tmpoptions+"</select></td>";
	tblhtml = tblhtml + "<td><input type=\"button\" class=\"button\" name=\"TableShowLeft\"  id=\"TableShowLeft\"  value=\"å³ç§»\" ><br><br><input type=\"button\" class=\"button\" name=\"TableShowRight\"  id=\"TableShowRight\"  value=\"å·¦ç§»\" ><br><br><input type=\"button\" class=\"button\"  name=\"TableShowTop\"  id=\"TableShowTop\"  value=\"ä¸ç§»\" ><br><br><input type=\"button\" class=\"button\" name=\"TableShowBottom\"  id=\"TableShowBottom\"  value=\"ä¸ç§»\"  ></td>";
	
	tmpoptions = "";
	for(i=0;i<s_array_newtitle.length;i++)
	{
		if(s_array_newtitle[i] != "")
			tmpoptions = tmpoptions + "<option value=\""+s_array_newmc[i]+"\">"+s_array_newtitle[i]+"</option>";
	}	
	
	tblhtml = tblhtml + "<td><select name=\"YShowField\"  id=\"YShowField\"  size=\"15\" style=\"width:150\"  >"+tmpoptions+"</select></td>";
	tblhtml = tblhtml + "</tr>";
	tblhtml = tblhtml + "<tr><td colspan=3 align=\"center\"><input type=\"button\" class=\"button\" name=\"TableShowOk\"  id=\"TableShowOk\"  value=\"ç¡®å®\"  >&nbsp;&nbsp;&nbsp;&nbsp;<input type=\"button\" class=\"button\" name=\"TableShowCancel\"  id=\"TableShowCancel\"  value=\"åæ¶\"  ></td></tr></table>";
	
	var tmpdiv = document.createElement("DIV");
	tmpdiv.id = "TblShowSetDiv";
	tmpdiv.style.position = "absolute";
	tmpdiv.style.zIndex = 2;
	tmpdiv.style.width = 360;
	tmpdiv.style.height = 280;
	tmpdiv.style.left = document.getElementById('alldiv').offsetLeft+2;
	tmpdiv.style.top = document.getElementById('alldiv').offsetTop+2;
	tmpdiv.style.backgroundColor = "#F5F7F9";
	tmpdiv.style.overflow = "auto";
	tmpdiv.innerHTML = tblhtml;
	document.body.appendChild(tmpdiv);
	
	document.getElementById("dShowField").ondblclick = LeftMoveShowField;
	
	document.getElementById("TableShowLeft").onclick = LeftMoveShowField;
	document.getElementById("TableShowLeft").onmouseover = new Function("this.style.cursor='hand';");
	
	document.getElementById("TableShowRight").onclick = RightMoveShowField;
	document.getElementById("TableShowRight").onmouseover = new Function("this.style.cursor='hand';");
	
	document.getElementById("TableShowTop").onclick = TopMoveShowField;
	document.getElementById("TableShowTop").onmouseover = new Function("this.style.cursor='hand';");
	
	document.getElementById("TableShowBottom").onclick = BottomMoveShowField;
	document.getElementById("TableShowBottom").onmouseover = new Function("this.style.cursor='hand';");
	
	document.getElementById("YShowField").ondblclick = RightMoveShowField;
	
	
	document.getElementById("TableShowOk").onclick = doChangeTableSet;
	document.getElementById("TableShowOk").onmouseover = new Function("this.style.cursor='hand';");
	
	document.getElementById("TableShowCancel").onclick = doCanCelTableSet;
	document.getElementById("TableShowCancel").onmouseover = new Function("this.style.cursor='hand';");
	
	
	document.getElementById('alldiv').disabled = true;
}

function doCanCelTableSet()
{
	if (document.getElementById('TblShowSetDiv') != null)
	{
		document.getElementById('TblShowSetDiv').removeNode(true);
	}
	document.getElementById('alldiv').disabled = false;
}

function LeftMoveShowField()
{
	var ObjdShowField = document.getElementById("dShowField");
	var ObjYShowField= document.getElementById("YShowField");
	
	if (ObjdShowField.selectedIndex >=0)
	{
		var newoption = document.createElement("OPTION");
		var tmpIndex = ObjdShowField.selectedIndex;
		ObjYShowField.options.add(newoption);
		newoption.innerText = ObjdShowField.options[tmpIndex].text;
		newoption.value = ObjdShowField.options[tmpIndex].value;
		ObjdShowField.options.remove(tmpIndex);
		if (tmpIndex < ObjdShowField.options.length)
		{
			ObjdShowField.selectedIndex = tmpIndex;
		}
	}
}

function RightMoveShowField()
{
	var ObjdShowField = document.getElementById("dShowField");
	var ObjYShowField= document.getElementById("YShowField");
	
	if (ObjYShowField.selectedIndex >=0)
	{
		var newoption = document.createElement("OPTION");
		var tmpIndex = ObjYShowField.selectedIndex;
		ObjdShowField.options.add(newoption);
		newoption.innerText = ObjYShowField.options[tmpIndex].text;
		newoption.value = ObjYShowField.options[tmpIndex].value;
		ObjYShowField.options.remove(tmpIndex);
		if (tmpIndex < ObjYShowField.options.length)
		{
			ObjYShowField.selectedIndex = tmpIndex;
		}
	}
}
function TopMoveShowField()
{	
	var ObjYShowField= document.getElementById("YShowField");
	if (ObjYShowField.selectedIndex > 0 )
	{
		var tmpIndex = ObjYShowField.selectedIndex -1;
		var tmpText = ObjYShowField.options[tmpIndex].text;
		var tmpValue = ObjYShowField.options[tmpIndex].value;
		
		ObjYShowField.options[tmpIndex].text = ObjYShowField.options[tmpIndex+1].text;
		ObjYShowField.options[tmpIndex].value = ObjYShowField.options[tmpIndex+1].value;
		
		tmpIndex = tmpIndex + 1;
		ObjYShowField.options[tmpIndex].text = tmpText;
		ObjYShowField.options[tmpIndex].value = tmpValue;
		
		ObjYShowField.selectedIndex = tmpIndex - 1;
		
	}
}
function BottomMoveShowField()
{
	var ObjYShowField= document.getElementById("YShowField");
	
	if (ObjYShowField.selectedIndex >= 0 && ObjYShowField.selectedIndex < ObjYShowField.options.length-1)
	{
		var tmpIndex = ObjYShowField.selectedIndex + 1;
		var tmpText = ObjYShowField.options[tmpIndex].text;
		var tmpValue = ObjYShowField.options[tmpIndex].value;
		
		ObjYShowField.options[tmpIndex].text = ObjYShowField.options[tmpIndex-1].text;
		ObjYShowField.options[tmpIndex].value = ObjYShowField.options[tmpIndex-1].value;
		
		tmpIndex = tmpIndex - 1;
		ObjYShowField.options[tmpIndex].text = tmpText;
		ObjYShowField.options[tmpIndex].value = tmpValue;
		
		ObjYShowField.selectedIndex = tmpIndex + 1;
		
	}
}

function doChangeTableSet()
{
	var ObjYShowField= document.getElementById("YShowField");
	var ObjDShowField= document.getElementById("dShowField");
	if (ObjYShowField.options.length == 0)
	{
		alert('è¯·è®¾ç½®æ¾ç¤ºå­æ®µ!');
		return false;
	}
	var tmpFieldMc_new = "";
	var tmpFieldMc_old = "";
	for(i=0;i<ObjYShowField.options.length;i++) {
		tmpFieldMc_new = tmpFieldMc_new + "," + ObjYShowField.options[i].value;
	}
	for(i=0;i<ObjDShowField.options.length;i++) {
		tmpFieldMc_old = tmpFieldMc_old + "," + ObjDShowField.options[i].value;
	}
	document.getElementById("tableFields").value = tmpFieldMc_new.replace(",","");
	document.getElementById("otherFields").value = tmpFieldMc_old.replace(",","") ;
	
	doCanCelTableSet();
	window.Form1.submit();
}

function findPositionY( obj ) {
  if( obj.offsetParent ) {
      for( var posX = 0, posY = 0; obj.offsetParent; obj = obj.offsetParent ) {
        posX += obj.offsetLeft;
        posY += obj.offsetTop;
      }
      return posY;
  } else {
      return obj.y;
  }
 }
 
 
 //********************************å·²ä¸åè½ä¸ºæ¹éä¿®æ¹æ¶ä½¿ç¨ å¼å§*********************************
	var tableName = "";
	var option_value = "";
	var option_name = "";
	var option_where = "";
	function changeUpdateField(obj) {
		var update_field = obj.value.split(":")[0];
		var selectField;
		var selectField_update;
		if(selectFields != "") {
			selectField = selectFields.split("#");
		}
		
		if(selectField != undefined) {
			for(var i=0;i<selectField.length;i++) {
				if(update_field == selectField[i].split(":")[0]) {
					selectField_update = selectField[i];
					break;
				}
			}
			if(selectField_update != undefined) {
				//éè¿DWRæ¥è¯¢
				if(selectField_update.split(":")[1] == 0) {
					tableName = selectField_update.split(":")[2];
					option_value = selectField_update.split(":")[3];
					option_name = selectField_update.split(":")[4];
					option_where =  selectField_update.split(":")[5];
					DWREngine.setAsync(false);
					dwrMonitor.getDataList(tableName,option_value,option_name,option_where,getDataResult);
				}
				//éæè®¾ç½®select
				if(selectField_update.split(":")[1] == 1) {
					var options = selectField_update.split(":")[2];
					var option = options.split("$");
					var ops = "";
					for(var j=0;j<option.length;j++) {
						option[j] = "'"+option[j].replace("|","':'")+"'";
						ops = ops + "," + option[j];
					}
					ops = ops.replace(",","");
					ops = "{"+ops+"}";
					document.getElementById("ZdSzValue_text").innerHTML = "";
					document.getElementById("ZdSzValue_select").innerHTML = "<select id=\"ZdSzValue\" name=\"ZdSzValue\"></select>"
					document.getElementById("ZdSzValue_select").style.visibility = "visible";
					DWRUtil.addOptions(ZdSzValue,objectEval(ops));
				}
				//å¤æ¥JSæ¹æ³
				if(selectField_update.split(":")[1] == 2) {
					
					var jsMethod = "";
					if(selectField_update.indexOf("$id") >= 0) {
						jsMethod = selectField_update.split(":")[2].replace("$id","ZdSzValue").replace("$value","ZdSzValue_value");
						document.getElementById("ZdSzValue_text").innerHTML = "<input type=\"hidden\" id=\"ZdSzValue\" name=\"ZdSzValue\"><input type=\"text\" id=\"ZdSzValue_value\" name=\"ZdSzValue_value\" class=\"mytext\" size=\"15\" >"
						document.getElementById("ZdSzValue_value").readOnly = true;
						document.getElementById("ZdSzValue").readOnly = true;
					}else{
						jsMethod = selectField_update.split(":")[2].replace("$value","ZdSzValue");
						document.getElementById("ZdSzValue_text").innerHTML = "<input type=\"text\" id=\"ZdSzValue\" name=\"ZdSzValue\" class=\"mytext\" size=\"15\" >"
						document.getElementById("ZdSzValue").readOnly = true;
					}
					document.getElementById("ZdSzValue_select").innerHTML = "";
					
					document.getElementById("ZdSzValue_text").style.visibility = "visible";
					document.getElementById("cmdselect").style.visibility = "visible";
					document.getElementById("cmdselect").onclick = new Function(jsMethod);
				}
				//åæ¥JSæ¹æ³
				if(selectField_update.split(":")[1] == 3) {
					
					var jsMethod = "";
					if(selectField_update.indexOf("$id") >= 0) {
						jsMethod = selectField_update.split(":")[2].replace("$id","ZdSzValue").replace("$value","ZdSzValue_value");
						document.getElementById("ZdSzValue_text").innerHTML = "<input type=\"hidden\" id=\"ZdSzValue\" name=\"ZdSzValue\"><input type=\"text\" id=\"ZdSzValue_value\" name=\"ZdSzValue_value\" class=\"mytext\" size=\"15\" >"
						document.getElementById("ZdSzValue_value").readOnly = true;
						document.getElementById("ZdSzValue").readOnly = true;
					}else{
						jsMethod = selectField_update.split(":")[2].replace("$value","ZdSzValue");
						document.getElementById("ZdSzValue_text").innerHTML = "<input type=\"text\" id=\"ZdSzValue\" name=\"ZdSzValue\" class=\"mytext\" size=\"15\" >"
						//document.getElementById("ZdSzValue").readOnly = true;
					}
					document.getElementById("ZdSzValue_select").innerHTML = ""; 
					document.getElementById("ZdSzValue_text").style.visibility = "visible";
					document.getElementById("cmdselect").style.visibility = "hidden";
					document.getElementById("ZdSzValue").onclick = new Function(jsMethod);
				}
			}else{
				document.getElementById("ZdSzValue_select").innerHTML = "";
				document.getElementById("ZdSzValue_text").innerHTML = "<input type=\"text\" id=\"ZdSzValue\" name=\"ZdSzValue\" class=\"mytext\" size=\"15\" >"
				document.getElementById("ZdSzValue_text").style.visibility = "visible";
				if(obj.value == "") document.getElementById("ZdSzValue").readOnly = true;
			}
		}
	}
	
	function getDataResult(dataList) {
		document.getElementById("ZdSzValue_text").innerHTML = "";
		document.getElementById("ZdSzValue_select").innerHTML = "<select id=\"ZdSzValue\" name=\"ZdSzValue\"></select>"
		document.getElementById("ZdSzValue_select").style.visibility = "visible";
		DWRUtil.addOptions("ZdSzValue",dataList,0,1);
	}
	
//********************************å·²ä¸åè½ä¸ºæ¹éä¿®æ¹æ¶ä½¿ç¨ ç»æ*********************************

//****************************å·²ä¸åè½ä¸ºæç´¢æ¶ä½¿ç¨ å¼å§********************************
	var query_index = 0;
	function isHiddenSelect(obj,indexf,oldValue) {
		//å¦æåæ¥æ¯ä¸ªéæ©æ¡ï¼åä¸ç¨è®¾ç½®é»è®¤å¼ã
		if(document.getElementById("SValue"+indexf+"_select").innerHTML != "")
		{
			oldValue = "";
		}
	
		query_index = indexf;
		var update_field = obj.value.split(":")[0];
		var selectField;
		var selectField_update;
		if(selectFields_query != "") {
			selectField = selectFields_query.split("#");
		}
		
		for(var i=0;i<selectField.length;i++) {
			if(update_field == selectField[i].split(":")[0]) {
				selectField_update = selectField[i];
				break;
			}
		}
		if(selectField_update != undefined) {
			//éè¿DWRæ¥è¯¢
			if(selectField_update.split(":")[1] == 0) {
				tableName = selectField_update.split(":")[2];
				option_value = selectField_update.split(":")[3];
				option_name = selectField_update.split(":")[4];
				option_where =  selectField_update.split(":")[5];
				DWREngine.setAsync(false);
				dwrMonitor.getDataList(tableName,option_value,option_name,option_where,getDataResultForQuery);
				
				document.getElementById("submit_select_hidden"+query_index).value = "";
				document.getElementById("submit_select_hidden"+query_index).style.visibility = "hidden";
			}
			//éæè®¾ç½®select
			if(selectField_update.split(":")[1] == 1) {
				var options = selectField_update.split(":")[2];
				var option = options.split("$");
				var ops = "";
				for(var j=0;j<option.length;j++) {
					option[j] = "'"+option[j].replace("|","':'")+"'";
					ops = ops + "," + option[j];
				}
				ops = ops.replace(",","");
				ops = "{"+ops+"}";
				document.getElementById("SValue"+query_index+"_text").innerHTML = "";
				document.getElementById("SValue"+query_index+"_select").innerHTML = "<select id=\"SValue"+query_index+"\" name=\"SValue"+query_index+"\"></select>"
				document.getElementById("SValue"+query_index+"_select").style.visibility = "visible";
				DWRUtil.addOptions("SValue"+query_index,{'':'--å¨é--'}); 
				DWRUtil.addOptions("SValue"+query_index,objectEval(ops));
				
				document.getElementById("submit_select_hidden"+query_index).value = "";
				document.getElementById("submit_select_hidden"+query_index).style.visibility = "hidden";
			}
			//å¤æ¥JSæ¹æ³
			if(selectField_update.split(":")[1] == 2) {
				var jsMethod = selectField_update.split(":")[2].replace("$value","SValue"+query_index);
				
				document.getElementById("SValue"+query_index+"_select").innerHTML = "";
				document.getElementById("SValue"+query_index+"_text").innerHTML = "<input type=\"text\" id=\"SValue"+query_index+"\" name=\"SValue"+query_index+"\" class=\"mytext\" value=\"" + oldValue + "\" size=\"10\" >"
				document.getElementById("SValue"+query_index+"_text").style.visibility = "visible";
				document.getElementById("submit_select_hidden"+query_index).value = "éæ©";
				document.getElementById("submit_select_hidden"+query_index).style.visibility = "visible";
				document.getElementById("submit_select_hidden"+query_index).onclick = new Function(jsMethod);
			}
		}else{
			document.getElementById("SValue"+query_index+"_select").innerHTML = "";
			document.getElementById("SValue"+query_index+"_text").innerHTML = "<input type=\"text\" id=\"SValue"+query_index+"\" name=\"SValue"+query_index+"\" class=\"mytext\" value=\"" + oldValue + "\" size=\"10\" >"
			document.getElementById("SValue"+query_index+"_text").style.visibility = "visible";
			if(obj.value == "") document.getElementById("SValue"+query_index).readOnly = true;
			
			document.getElementById("submit_select_hidden"+query_index).value = "";
			document.getElementById("submit_select_hidden"+query_index).style.visibility = "hidden";
		}
	}
	
	function getDataResultForQuery(dataList) {
		document.getElementById("SValue"+query_index+"_text").innerHTML = "";
		document.getElementById("SValue"+query_index+"_select").innerHTML = "<select id=\"SValue"+query_index+"\" name=\"SValue"+query_index+"\"></select>"
		document.getElementById("SValue"+query_index+"_select").style.visibility = "visible";
		DWRUtil.addOptions("SValue"+query_index,{'':'--å¨é--'}); 
		DWRUtil.addOptions("SValue"+query_index,dataList,0,1);
	}
//**************************************å·²ä¸åè½ä¸ºæç´¢æ¶ä½¿ç¨ç»æ*****************************************

/*****************************ä»¥ä¸åè½ä¸ºæ¥è¯¢è¿ååä¿å­åæç¶æä½¿ç¨********************************/
var dir = location.href.substring(0,location.href.lastIndexOf('/')+1);
var radomLen = location.href.lastIndexOf('&tktime');
if(radomLen == -1)
{
	radomLen = location.href.length;
}
var courrentUrl = location.href.substring(dir.length,radomLen);
radomLen = courrentUrl.lastIndexOf('?tktime');
if(radomLen == -1)
{
	radomLen = courrentUrl.length;
}
courrentUrl = courrentUrl.substring(0, radomLen);

/**
 * ä¿å­æç´¢æ°æ®
 */
function saveSearchData() {
	var searchStr = "";
	searchStr = searchStr + processSearchStr();
	searchStr = "{"+searchStr.replace(",","")+"}";
	dwrMonitor.setSearchBaseBean(courrentUrl + user,objectEval(searchStr));
}
/**
 * å¤çæç´¢æ°æ®
 */
function processSearchStr() {
	var searchStr = "";
	var divObj = document.getElementById("search_values");

	if(divObj != null) {
		var inputData = divObj.getElementsByTagName("input");
		var selectData = divObj.getElementsByTagName("select");
		for(var i=0;i<inputData.length;i++) {
			if(inputData[i].type != "button" && inputData[i].type != "reset") {
				searchStr = searchStr + "," + inputData[i].name + ":'" + inputData[i].value + "'";
			}
		}
		for(var j=0;j<selectData.length;j++) {
			searchStr = searchStr + "," + selectData[j].name + ":'" + selectData[j].value + "'";
		}
	}
	
	return searchStr;
}
	var isCompleInit=true;
	function initSearchValue() {
	isCompleInit=false;
		DWREngine.setAsync(false);
		dwrMonitor.getSearchValue(searchValue);
		isCompleInit=true;
	}
	function searchValue(mapObj) {
		var value = mapObj[courrentUrl + user];
		if(value != null) {
			var divObj = document.getElementById("search_values");
			if(divObj != null) {
				var inputData = divObj.getElementsByTagName("input");
				var selectData = divObj.getElementsByTagName("select");
			    
				for(var i=0;i<inputData.length;i++) {
					if(inputData[i].type != "button" && inputData[i].type != "reset") {
							if(value[inputData[i].name] != undefined)
							   inputData[i].value = value[inputData[i].name];
					}
				}
				for(var j=0;j<selectData.length;j++) {
						if(value[selectData[j].name] != undefined) {
						   selectData[j].value = value[selectData[j].name];
						}
				}
			}
		}
	}
	/*****************************ä»¥ä¸åè½ä¸ºæ¥è¯¢è¿ååä¿å­åæç¶æä½¿ç¨********************************/
	
  
  /*****************************ä»¥ä¸åè½ä¸ºçæajaxæ ä½¿ç¨********************************/
  var dataList;
  var parameter = "";
  var sunParameter = "";
  var beanName;
  var pName;
  var idName;
  var showName;
  var defaultPValue="0";
  function setParameter(name,value) {
  	  if(this.parameter == "") {
  	  	 parameter = name + ":'" + value + "'";
  	  }else{
  	  	 parameter = parameter + "," + name + ":'" + value + "'";
  	  }
  }
  function setSunParameter(name,value) {
  	  sunParameter = name + ":'" + value + "'";
  }
  
  
  var treeTableIndex = null;
  function getDatas(beanName) {
  	  DWREngine.setAsync(false);
  	  if(parameter != "") parameter = parameter + ",";
  	  var parameter_tmp = parameter + sunParameter;
  	  parameter_tmp = objectEval("{"+parameter_tmp+"}");
  	  dwrMonitor.getTreeDataList(beanName,parameter_tmp,outList);
  }
  function getDatasForAjax(tableStr,pId,indexf) {
  	  DWREngine.setAsync(false);
  	  //var indexf = tableStr.split(":")[0];
  	  var parameter_tmp = objectEval("{"+tableStr+"}");
  	  dwrMonitor.getAjaxMoreTreelist(parameter_tmp,indexf,pId,treeTableIndex,outList);
  }
  function outList(list) {
  	  dataList = list;
  }
  
  var ajax_tree_tables = new Array();
  function fillTree_moreTable() {
  	 getDatasForAjax(ajax_tree_tables[0],"0","0");
     var html = "";
   	 html = html + '<div class="dTreeNode">';
	html = html + '';
	html = html + '<a id="sd0" class="node" href=javascript:goUrl(0)>ææ</a>';
	html = html + '</div>';
  	for(var i=1;i<=dataList.length;i++) {
  		html = html + "<div class='dTreeNode'>";
  		if(1) {
  			html = html + "<a href=javascript:void(0) onclick=javascript:doFill_moreTable(this,"+i+",1,'"+dataList[i-1][0]+"'); id='close'><img id='jd"+i+"' src='"+imgPath+"/js/dtree/img/plus.gif'/></a>";
  			html = html + "<img id='folder"+i+"' src='"+imgPath+"/js/dtree/img/folder.gif' />";
  			
  		}else{
	  		html = html + "<img src='"+imgPath+"/js/dtree/img/join.gif' />";
	  		html = html + "<img src='"+imgPath+"/js/dtree/img/page.gif' />";
  		}
  		html = html + "<a class='node' href=javascript:goUrl('"+dataList[i-1][0]+"')>"+dataList[i-1][1]+"</a>";
  		html = html + "<div id='dd"+i+"' class='clip' style='display:none;'></div>";
  		html = html + "<div>";
  	}
  	theTree.innerHTML = html;
  }
  function doFill_moreTable(obj,k,indexf,pId) {
  	
  	if(indexf>ajax_tree_tables.length-1)
  		getDatasForAjax(ajax_tree_tables[ajax_tree_tables.length-1],pId,indexf);
  	else
    	getDatasForAjax(ajax_tree_tables[indexf],pId,indexf);
  	var k_te = ""+k;
  	var html = "";
  	for(var i=0;i<dataList.length;i++) {
  			html = html + '<div class="dTreeNode">';
  			if(treeTableIndex != null) {
	  			if(ajax_tree_tables.length > indexf+1 || 1) {
	  				for(var s=0;s<k_te.length;s++) {
	  					html = html + '<img src="'+imgPath+'/js/dtree/img/line.gif" alt="" />';
	  				}
	  				//å¤æ­æ¯å¦æ¯å«åè¡¨ç
	  				if(treeTableIndex != null) {
	  					if((indexf) == treeTableIndex.split("#")[0]) {
	  						html = html + "<a href=javascript:void(0) onclick=javascript:doFill_moreTable(this,"+k+i+","+(indexf)+",'"+dataList[i][0]+"'); id='close'><img id='jd"+k+i+"' src='"+imgPath+"/js/dtree/img/plus.gif'/></a>";
	  					}else
	  						html = html + "<a href=javascript:void(0) onclick=javascript:doFill_moreTable(this,"+k+i+","+(indexf+1)+",'"+dataList[i][0]+"'); id='close'><img id='jd"+k+i+"' src='"+imgPath+"/js/dtree/img/plus.gif'/></a>";
	  				}else
						html = html + "<a href=javascript:void(0) onclick=javascript:doFill_moreTable(this,"+k+i+","+(indexf+1)+",'"+dataList[i][0]+"'); id='close'><img id='jd"+k+i+"' src='"+imgPath+"/js/dtree/img/plus.gif'/></a>";
					html = html + '<img id="folder'+k+i+'" src="'+imgPath+'/js/dtree/img/folder.gif" alt="" />';
	  			}else{
	  				for(var s=0;s<k_te.length;s++) {
						html = html + '<img src="'+imgPath+'/js/dtree/img/line.gif" alt="" />';
					}
					html = html + '<img src="'+imgPath+'/js/dtree/img/join.gif" alt="" />';
					html = html + '<img id="id4" src="'+imgPath+'/js/dtree/img/page.gif" alt="" />';
				}
			}else{
				if(ajax_tree_tables.length > indexf+1) {
	  				for(var s=0;s<k_te.length;s++) {
	  					html = html + '<img src="'+imgPath+'/js/dtree/img/line.gif" alt="" />';
	  				}
	  				html = html + "<a href=javascript:void(0) onclick=javascript:doFill_moreTable(this,"+k+i+","+(indexf+1)+",'"+dataList[i][0]+"'); id='close'><img id='jd"+k+i+"' src='"+imgPath+"/js/dtree/img/plus.gif'/></a>";
					html = html + '<img id="folder'+k+i+'" src="'+imgPath+'/js/dtree/img/folder.gif" alt="" />';
	  			}else{
	  				for(var s=0;s<k_te.length;s++) {
						html = html + '<img src="'+imgPath+'/js/dtree/img/line.gif" alt="" />';
					}
					html = html + '<img src="'+imgPath+'/js/dtree/img/join.gif" alt="" />';
					html = html + '<img id="id4" src="'+imgPath+'/js/dtree/img/page.gif" alt="" />';
				}
			}
			html = html + '<a id="sd4" class="node" href=javascript:goUrl("'+dataList[i][0]+'")>'+dataList[i][1]+'</a>';
			html = html + "<div id='dd"+k+i+"' class='clip' style='display:none;'></div>";
			html = html + '</div>';
	}
	
	document.getElementById("dd"+k).innerHTML = html;
  	document.getElementById("dd"+k).style.display = "block";
  	if(obj.id=="open") {
  	    document.getElementById("dd"+k).style.display = "none";
  		document.getElementById("jd"+k).src=imgPath+"/js/dtree/img/plus.gif";
  		document.getElementById("folder"+k).src=imgPath+"/js/dtree/img/folder.gif";
  		obj.id="close";
  		
  	}
  	else{
  		document.getElementById("jd"+k).src=imgPath+"/js/dtree/img/minus.gif";
  		document.getElementById("folder"+k).src=imgPath+"/js/dtree/img/folderopen.gif";
  		obj.id="open";
  	}
  }

  function fillTree_oneTable() {
  	setSunParameter(pName,defaultPValue);
    getDatas(beanName);
    var html = "";
    html = html + '<div class="dTreeNode">';
	html = html + '';
	html = html + '<a id="sd0" class="node" href=javascript:goUrl(0)>ææ</a>';
	html = html + '</div>';
  	for(var i=1;i<=dataList.length;i++) {
  		html = html + "<div class='dTreeNode'>";
  		if(dataList[i-1]["haveSon"] == "1" || 1) {
  			html = html + "<a href=javascript:void(0) onclick=javascript:doFill_oneTable(this,"+i+",'"+dataList[i-1][idName]+"'); id='close'><img id='jd"+i+"' src='"+imgPath+"/js/dtree/img/plus.gif'/></a>";
  			html = html + "<img id='folder"+i+"' src='"+imgPath+"/js/dtree/img/folder.gif' />";
  			
  		}else{
	  		html = html + "<img src='"+imgPath+"/js/dtree/img/join.gif' />";
	  		html = html + "<img src='"+imgPath+"/js/dtree/img/page.gif' />";
  		}
  		html = html + "<a class='node' href=javascript:goUrl('"+dataList[i-1][idName]+"')>"+dataList[i-1][showName]+"</a>";
  		html = html + "<div id='dd"+i+"' class='clip' style='display:none;'></div>";
  		html = html + "<div>";
  	}
  	theTree.innerHTML = html;
  }
  
  function doFill_oneTable(obj,k,pId) {
    sunParameter = "";
  	setSunParameter(pName,pId);
    getDatas(beanName);
  	var k_te = ""+k;
  	var html = "";
  	for(var i=0;i<dataList.length;i++) {
  			html = html + '<div class="dTreeNode">';
  			if(dataList[i]["haveSon"] == "1" || 1) {
  				for(var s=0;s<k_te.length;s++) {
  					html = html + '<img src="'+imgPath+'/js/dtree/img/line.gif" alt="" />';
  				}
				html = html + "<a href=javascript:void(0) onclick=javascript:doFill_oneTable(this,"+k+i+",'"+dataList[i][idName]+"'); id='close'><img id='jd"+k+i+"' src='"+imgPath+"/js/dtree/img/plus.gif'/></a>";
				html = html + '<img id="folder'+k+i+'" src="'+imgPath+'/js/dtree/img/folder.gif" alt="" />';
  			}else{
  				for(var s=0;s<k_te.length;s++) {
					html = html + '<img src="'+imgPath+'/js/dtree/img/line.gif" alt="" />';
				}
				html = html + '<img src="'+imgPath+'/js/dtree/img/join.gif" alt="" />';
				html = html + '<img id="id4" src="'+imgPath+'/js/dtree/img/page.gif" alt="" />';
			}
			html = html + '<a id="sd4" class="node" href=javascript:goUrl("'+dataList[i][idName]+'")>'+dataList[i][showName]+'</a>';
			html = html + "<div id='dd"+k+i+"' class='clip' style='display:none;'></div>";
			html = html + '</div>';
	}
	document.getElementById("dd"+k).innerHTML = html;
  	document.getElementById("dd"+k).style.display = "block";
  	if(obj.id=="open") {
  	    document.getElementById("dd"+k).style.display = "none";
  		document.getElementById("jd"+k).src=imgPath+"/js/dtree/img/plus.gif";
  		document.getElementById("folder"+k).src=imgPath+"/js/dtree/img/folder.gif";
  		obj.id="close";
  		
  	}
  	else{
  		document.getElementById("jd"+k).src=imgPath+"/js/dtree/img/minus.gif";
  		document.getElementById("folder"+k).src=imgPath+"/js/dtree/img/folderopen.gif";
  		obj.id="open";
  	}
  }
  /**
  * _beanName:è¡¨å¯¹åºçbeanå¯¹è±¡; _pName:çæçæ ç¶IDçåç§°; _idName:çæçæ ä¸»IDçåç§°;
  * _showName:çæçæ ä¸­æ¾ç¤ºnameçåç§°; _defaultPValue:ç¬¬ä¸çº§çç¶IDçé»è®¤å¼
  */
  function initAjaxTree(_beanName,_pName,_idName,_showName,_defaultPValue) {
  	  beanName = _beanName;
   	  pName = _pName;
   	  idName = _idName;
   	  showName = _showName;
   	  defaultPValue = _defaultPValue;
   	  fillTree_oneTable();
  }
  /*****************************ä»¥ä¸åè½ä¸ºçæajaxæ ä½¿ç¨********************************/
	
	function objectEval(text){
	    // eval() breaks when we use it to get an object using the { a:42, b:'x' }
	    // syntax because it thinks that { and } surround a block and not an object
	    // So we wrap it in an array and extract the first element to get around
	    // this.
	    // This code is only needed for interpreting the parameter input fields,
	    // so you can ignore this for normal use.
	    // The regex = [start of line][whitespace]{[stuff]}[whitespace][end of line]
	    text = text.replace(/\n/g, ' ');
	    text = text.replace(/\r/g, ' ');
	    if (text.match(/^\s*\{.*\}\s*$/))
	    {
	      text = '[' + text + '][0]';
	    }
	    return eval(text);
   }
   //è·åcheckboxçå¼èµäºéèå check_object_idå¼ä¸check_object_nameå¼
   /**
   var objId;
   var objName;
   function checkboxValue(e)
   {
	var check_object_id=document.getElementById("check_object_id");
	var check_object_name=document.getElementById("check_object_name");
	var str=new Array;
	str=e.value.split(",");
	check_object_id.value=check_object_id.value+","+str[0];
	
	check_object_name.value=check_object_name.value+","+str[1];
	
   }
   function getCheckBoxValue(isClose) {
	    if(isClose == undefined) isClose = true;
	    var inpuSize=document.getElementsByTagName("input");
	    for(var i=0;i<inpuSize.length;i++)
	    {
	    	if(inpuSize[i].type=="checkbox")
	    	{
	    			if(inpuSize[i].checked==true)
	    			{
	    				var str=inpuSize[i].value;//è·åcheckboxçå¼
						var strlist=new Array;
						strlist=str.split(",");
						var str=document.getElementById("check_object_id").value;
						var str2=document.getElementById("check_object_name").value;
						str=str+strlist[0]+",";
						str2=str2+strlist[1]+",";	
						document.getElementById("check_object_id").value=str;
						document.getElementById("check_object_name").value=str2;
						
	    			}
	    	}
	    }
	     document.getElementById("check_object_id").value=document.getElementById("check_object_id").value.substring(0,document.getElementById("check_object_id").value.lastIndexOf(","));
	     document.getElementById("check_object_name").value=document.getElementById("check_object_name").value.substring(0,document.getElementById("check_object_name").value.lastIndexOf(","));
					
	  	window.returnValue=document.getElementById("check_object_id").value+"||"+document.getElementById("check_object_name").value;	
	   	if(isClose) window.close();
   }
   function showModal(url,parameterId,parameterName,e) {
	   var value=window.showModalDialog(url,e);
	   var valueList=new Array;
	   valueList=value.split("||");
	   document.getElementById(parameterId).value=valueList[0];
	   document.getElementById(parameterName).value=valueList[1];
   }
   **/
   function getCheckBoxIds(colId) {
		var col = document.all(colId);
		var ids = new Array();
		var j = 0;
		if(col!=null){
          if(isNaN(col.length)){
             if(document.all(colId).checked){
                ids[0] = document.all(colId).value;
             }
          }else{
			 for(var i=0; i<col.length; i ++){
              if(col[i].checked){
                ids[j] = col[i].value;
				j ++;
              }
            }
		  }
        }
		return ids;
	}
	function getCheckBoxValues(isClose) {
		var ids = getCheckBoxIds("C_Select");
		if(ids.length == 0){
	        alert("æ²¡æéæ©ç¸å³ä¿¡æ¯ï¼æä½æ æï¼");
	        return;
        }else{
        	//for()
        }
	}
	
	Array.prototype.remove=function(dx)
	{
	    if(isNaN(dx)||dx>this.length){return false;}
	    for(var i=0,n=0;i<this.length;i++)
	    {
	        if(this[i]!=this[dx])
	        {
	            this[n++]=this[i]
	        }
	    }
	    this.length-=1
	}
	
	
	///--------------------------ä»¥ä¸ç¨åºç¨äº:å½éæ©åè¡¨çé¡µé¢æ¶ä½¿ç¨,æ¯æç¿»é¡µéæ©----------------------////
	var idts = [];
    var namets = [];
    var namets1=[];
    var ids = "";
    var names = "";
    //edit by ywuei at 2010-09-14     
    function initOldDatas(old_ids,old_names) {
    	ids = old_ids;
    	names = old_names;
    	var col_tmp = document.all("C_Select");
    	
    	if(col_tmp!=null){
          if(isNaN(col_tmp.length)){
	          if(old_ids.indexOf(document.getElementById("C_Select").value.split(",")[0]) >= 0){
	               col_tmp.checked = true;
	          }
          }else{
			 for(var i=0; i<col_tmp.length; i++){
              	if((","+ids+",").indexOf(","+col_tmp[i].value.split(",")[0]+",") >= 0){
              		//vids += col_tmp[i].value.split(",")[0]+",";
              		//vnames += col_tmp[i].value.split(",")[1]+",";
                	col_tmp[i].checked = true;
              	}
             }
		  }
        }
       
        if(ids != "") {
        	//vids=vids.substring(0,vids.length-1);
        	ids = old_ids;
        	idts = ids.split(",");
    	}

    	if(names != "") {
    		//vnames = vnames.substring(0,vnames.length-1);
    		namets = old_names.split(",");
    	}
    	var html = "<font color='red'>" + names + "</font>";
    	document.getElementById("select_datas_names").innerHTML = "&nbsp;&nbsp;"+html;
    	document.getElementById("check_object_id").value = ids;
    	document.getElementById("check_object_name").value = names;
    	initCheckDatas("C_Select");
    }
    
    function resetDatas(){
    document.getElementById("select_datas_names").innerHTML ="";
    	document.getElementById("check_object_id").value ="";
    	document.getElementById("check_object_name").value ="";
    	 var old = false;
    	 document.all("C_SelectALL").checked=false;
        var col = document.all("C_Select");
        if(col!=null){
          if(col.length>=2){
            for(var i=0; i<col.length; i++){
			  if(col[i].disabled == false)
				col[i].checked = old;
            }
          }
          else{
			 if(col.disabled == false) {
				 col.checked = old;
			 }
          }
        }
    }
    
	function selectData(obj) {
    	if(obj.checked == true) {
    		var have = false;
    		for(var i=0;i<idts.length;i++) {
    			if(idts[i] == obj.value.split(",")[0]) {
    				have = true;
    			}
    		}
    		if(have == false) {
    			idts[idts.length] = obj.value.split(",")[0];
    			namets[namets.length] = obj.value.split(",")[1];
    			if(obj.value.split(",").length>2)
    			{
    			namets1[namets1.length] = obj.value.split(",")[2];
    		}}
    	}else{
    		for(var i=0;i<idts.length;i++) {
    			
    			if(idts[i] == obj.value.split(",")[0]) {
    				idts.remove(i);
    			}
    			if(namets[i] == obj.value.split(",")[1]) {
    				namets.remove(i);
    			}
    			if(obj.value.split(",").length>2)
    			{
    			  if(namets1[i] == obj.value.split(",")[1]) {
    				namets1.remove(i);
    			}
    			}
    		}
    	}
    	selectForHTML();
    }
    
    function selectForHTML() {
    	html = "";
    	ids = "";
    	names = "";
    	names1="";
    	for(var i=0;i<idts.length;i++) {
    		html = html + "," + namets[i];
    		ids = ids + "," + idts[i];
    		names = names + "," + namets[i];
    		if(namets1.length>0)
    		names1 = names1 + "," + namets1[i];
    	}
    	html = "<font color='red'>" + html.replace(",","") + "</font>";
    	ids = ids.replace(",","");
    	names = names.replace(",","");
    	names1 = names1.replace(",","");
    	document.getElementById("select_datas_names").innerHTML = "&nbsp;&nbsp;"+html;
    	document.getElementById("check_object_id").value = ids;
    	document.getElementById("check_object_name").value = names;
    	try{
    		document.getElementById("check_object_name1").value = names1;
    	}catch(e){}
    }
    //éä¸­ææçå¤éæ¡
    function selectAll_checkbox(call,cid){
        var old = document.all(call).checked;
        var col = document.all(cid);
        if(col!=null){
          if(col.length>=2){
            for(var i=0; i<col.length; i ++){
			  if(col[i].disabled == false)
				col[i].checked = old;
				selectData(col[i]);
            }
          }
          else{
			 if(col.disabled == false) {
				 col.checked = old;
			 	 selectData(col);
			 }
          }
        }
    }
    function initCheckDatas(colId) {
    	var ids_tmp = ","+document.getElementById("check_object_id").value+",";
    	var col_tmp = document.all(colId);
    	if(col_tmp!=null){
          if(isNaN(col_tmp.length)){
             if(ids_tmp.indexOf(","+document.getElementById(colId).value.split(",")[0]+",") >= 0){
                col_tmp.checked = true;
             }
          }else{
			 for(var i=0; i<col_tmp.length; i ++){
              if(ids_tmp.indexOf(","+col_tmp[i].value.split(",")[0]+",") >= 0){
                col_tmp[i].checked = true;
              }
            }
		  }
        }
    }
    //////////-----------------------ä»¥ä¸ç¨åºç¨äº:å½éæ©åè¡¨çé¡µé¢æ¶ä½¿ç¨,æ¯æç¿»é¡µéæ©-------------------////////////
   
   
   //è®©æææ§ä»¶ä¸å¯æä½
		function DisableAllControls(){ 
			var inputData = document.getElementsByTagName("input");
			var selectData = document.getElementsByTagName("select");
			var textareaData = document.getElementsByTagName("textarea");
			for(var i=0;i <inputData.length;i++){
				if(inputData[i].type == 'button')
					inputData[i].disabled=true;
				if(inputData[i].type == 'text')
					inputData[i].readOnly = true;
				inputData[i].onblur = "";
			}
			for(var j=0;j<selectData.length;j++) {
				selectData[j].disabled = true;
			}
			for(var j=0;j<textareaData.length;j++) {
				textareaData[j].readOnly = true;
			}
		}
		
	
	//å¤æ­è¡¨åä¸­çæ°æ®æ¯å¦ä½äºä¿®æ¹,å¦ææªä¿®æ¹ä¸åè®¸æäº¤
	var isTextChanged = false;
	function isFormChanged() {
		var form = document.forms[0];
		for (var i = 0; i < form.elements.length; i++) {
		   	var element = form.elements[i];
		   	var type = element.type;
		   	if (type == "text" || type == "hidden" || type == "textarea") {
		    	if (Trim(element.value) != Trim(element.defaultValue)) {
		     		isTextChanged = true;
		     		break;
		    	}
		   	} else if (type == "radio" || type == "checkbox") {
		    	if (element.checked != element.defaultChecked) {
		     		isTextChanged = true;
		     		break;
		    	}
		   	} else if (type == "select-one"||type == "select-multiple") {
		    	for (var j = 0; j < element.options.length; j++) {
		    		if(element.disabled== false) {
			     		if (element.options[j].selected != element.options[j].defaultSelected) {
			      			isTextChanged = true;
			      			break;
			     		}
		     		}
		    	}
		    	
		   	}else { 
		    	// etc...
		   	}
		}
		if(!isTextChanged) {
			document.forms(0).disabled = true;
			alert("æ¨æ²¡æä½ä»»ä½çä¿®æ¹,ä¸è½æäº¤è¡¨å!");
			document.forms(0).disabled = false;
			return false;
		}else{
			return true;
		}
	}
	
		function initSelectDefalt() {
			var form = document.forms[0];
			
			if(form == undefined) return;
			
			for (var i = 0; i < form.elements.length; i++) {
		   		var element = form.elements[i];
		   		var type = element.type;
				if (type == "select-one") {
					var isHaveDefault = false;
					for (var j = 0; j < element.options.length; j++) {
						if (element.options[j].defaultSelected == true) {
				      		isHaveDefault = true;
				      		break;
				     	}
			     	}
			
					if(!isHaveDefault) {
						if(element.options[0] != null)
			    			element.options[0].defaultSelected = true;
					}
			   	}
			}
		}
		
		
		
		
    /**
     * å°1,2,3,4,6,8,9,10,13è½¬æ¢æ 1-4,6,8-10,13
     * @param str
     * @return
     */
    function convertKkzc(str)
    {
		var strlist =  str.split(",");
		var strReturn = "";
		strReturn = strReturn + strlist[0];
		if (strlist.length > 1)
		{
		    for (i = 0; i < strlist.length; i++)
		    {
				var m = "";
				var n = "";
				var j = i + 1;
				for (j = i + 1; j < strlist.length; j++)
				{
				    if (strlist[j] ==  parseInt(strlist[j - 1]) + 1)
				    {
						m = strlist[j];
						continue;
				    } else
				    {
						n = strlist[j];
						break;
				    }
				}
				i = j - 1;
				if ("" != m)
				{
				    strReturn = strReturn + "-" + m;
				}
				if ("" != n)
				{
				    strReturn = strReturn + "," + n;
				}
			}
		}
		
		return strReturn;
    }
    
    
    /**
     * å° 1-4,6,8-10,13è½¬æ¢æ 1,2,3,4,6,8,9,10,13
     * @param str
     * @return
     */
    function ReserveConvertKkzc(str)
    {
		var strlist =  str.split(",");
		var strReturn = "";
		if (strlist.length > 0)
		{
		    for (i = 0; i < strlist.length; i++)
		    {
		    	var oneStrList = strlist[i].split("-");
		    	if (oneStrList.length > 1)
		    	{
		    		for (j = parseInt(oneStrList[0]); j <= parseInt(oneStrList[1]); j++)
		    		{
		    			strReturn = strReturn + j + ",";
		    		}
		    	}
		    	else
		    	{
		    		strReturn = strReturn + strlist[i] + ",";
		    	}
			}
		}
		
		return strReturn;
    }
    

    /**
     * å°1,2,3,4,6,8,9,10,13 è½¬æ¢æç¸å çæ°å­
     * @param str
     * @return
     */    
    function StringsToPlusValue(str)
    {
		var thisStr = str;
		var strlist =  thisStr.split(",");
		var iReturn = 0;
		if (strlist.length > 0)
		{
		    for (var i = 0; i < strlist.length; i++)
		    {
		    	if ("" != strlist[i])
		    	{
					iReturn += parseInt(strlist[i]);    	
		    	}
		    }
		    
		    return iReturn;
		}
		
		return 0;
    }
    
    
function get_radio_value (radio_array)
{
	var i;
    for (i = 0; null != radio_array && i < radio_array.length; ++ i)  //radio_array.lengthæ¯radioéé¡¹çä¸ªæ°
    	if (radio_array[i].checked)
        	return radio_array[i].value;
	return null;  //å¦æä¸é¡¹é½æ²¡éåè¿åç©ºå¼
}


String.prototype.replaceAll = function(reallyDo, replaceWith, ignoreCase) {   
    if (!RegExp.prototype.isPrototypeOf(reallyDo)) {   
        return this.replace(new RegExp(reallyDo, (ignoreCase ? "gi": "g")), replaceWith);   
    } else {   
        return this.replace(reallyDo, replaceWith);   
    }   
}   

//å¨è§è½¬æ¢ä¸ºåè§äºæ¢ï¼boo=1è¡¨ç¤ºåè§è½¬å¨è§ boo=0è¡¨ç¤ºå¨è§è½¬åè§
function stringToChange(Obj, boo)
{
    var result = "";
    var str = Obj.value;
    var charlist = "\";'<>";//åè§å­ç¬¦

    for(var i = 0; i < str.length; i++)//å­ç¬¦ä¸²strä¸­çå­ç¬¦ 
    {
        var c1 = str.charAt(i);
        var c2 = str.charCodeAt(i);
        if(charlist.indexOf(c1) > -1)
        {
            if(" " == c1)
            {
                result += "ã";
            }else
            {
                result += String.fromCharCode(str.charCodeAt(i) + 65248); 
            }
        }else
        {
            if(boo > 0)
            {
                result += String.fromCharCode(str.charCodeAt(i)); 
            }else
            {
                if("ã" == c1)
                {
                    result += " ";
                }else
                {
                    if(charlist.indexOf(String.fromCharCode(str.charCodeAt(i) - 65248)) > -1)
                    {
                        result += String.fromCharCode(str.charCodeAt(i) - 65248);
                    }else
                    {
                        result += String.fromCharCode(str.charCodeAt(i)); 
                    }
                }
            }
        } 
    } 
    Obj.value = result;
}

//è¿æ»¤å³é®å­ï¼ææææ¬æ¡ä¸åè®¸è¾å¥åè§ ' <> ç­å­ç¬¦
//å¨å»ºä¼ï¼ææ¶ä¸å¯ç¨ï¼å ä¸ºæåå·¦é®ï¼ä¸èµ·ä½ç¨
function filterKeyChar()
{
/*
    var input=document.getElementsByTagName("input");
    for(var i=0;i<input.length;i++)
    {
        if(input[i].type=="text")
            input[i].onkeyup=function(){
			    stringToChange(this, 1);
			}
            
    }
*/
}
//é·ç«å
//æ£æ¥å­ç¬¦æ¯å¦è¶åºéå¶ï¼ä¸­æåæ¬ï¼
function checkstringlength(obj,number,strnew)
{
    var str=obj.value;
    var len2=0;
    for (var i=0; i<str.length; i++) {   
        if (str.charCodeAt(i)>127 || str.charCodeAt(i)==94) {   
            len2 += 2;   
        } else {   
            len2 ++;   
        }   
        }
   if(len2>number)
   {
    alert(strnew+"é¿åº¦è¿é¿ï¼è¯·éæ°è¾å¥");
    obj.focus();
    
   return false;
   
   }
   else
   {
   return true;
   }
}
//é·ç«å
//ç»ç©ºå¼èµæå®å¼
function setValueNumber(value,setvalue)
{

if(isEmpty(value))
{

 return setvalue;
}

return value;
}


//å·¦å³ç§»å¨Option
function moveOption(_objLeft, _objRight, _remainOld)
{
	var objLeft = document.getElementById(_objLeft);
	var objRight = document.getElementById(_objRight);
	
	for (var i = 0; i < objLeft.options.length; i++)
	{
		if(objLeft.options[i].selected)
		{
			objRight.add(new Option(objLeft.options[i].text, objLeft.options[i].value));	
			
			if (_remainOld == false)
			{
				objLeft.remove(i);
				i--;
			}
		}
	}
}
//æ£æ¥è¾å¥æ¯å¦æ¯æ°å­èä¸å¿é¡»å°äºå¤å°  code by yuwei
function checkcapitalAndValue(input, limit,msg, flag) {
	if (input.value == "") return false;
	str = input.value;
	var checkOK;
	var checkStr = str;
	var allValid = true;
	var allNum = "";
	if (flag == 0) {
		checkOK = "0123456789-, ";
	} else {
		checkOK = "0123456789";
	}
	for (i = 0; i < checkStr.length; i++) {
		ch = checkStr.charAt(i);
		for (j = 0; j < checkOK.length; j++) {
			if (ch == checkOK.charAt(j)) {
				break;
			}
		}
		if (j == checkOK.length) {
			allValid = false;
			break;
		}
		allNum += ch;
	}
	if (!allValid) {
		alert(msg+"è¾å¥çæ°æ®å¿é¡»æ¯æ°å­!");
		input.value = "";
		input.focus();
		input.select();
		return (false);
	}else if(input.value>limit){
		alert(msg+"è¾å¥çæ°æ®å¿é¡»å°äº"+limit);
		input.value = "";
		input.focus();
		input.select();
		return (false);
	}
	return true;
}
//åå§åå®¡æ ¸æ°æ®
function onworkflow(){
     url = "${pageContext.request.contextPath}/workflow.do?method=workflowShowProcess";
     var ajax = new Ajax.Request(url,
     {
      method:'post',
      onSuccess:onDw
     }
     );
  } 
function onDw(response){} 
//å¤æ­adsuæ ç­¾ä¸­å¤ä¸ªå­æ®µç»åå¯ä¸	
//typeç±»å addå¢å  updateä¿®æ¹ 
//windowtypeå¼¹åºçªå£ç±»å alertæç¤ºçª confirmæ¶æ¯ç¡®è®¤åæ¶çª
//tableNameè¡¨å
//coloumName1ç»åå­æ®µå¶ä¸
//coloumName2ç»åå­æ®µå¶äº
//whereStringç»è£æ¡ä»¶å­ç¬¦ä¸²(å¯å¯¹Nä¸ªç»åæ¡ä»¶è¿è¡å¤æ­)
//stralertæç¤ºè¯­å¥
//åèç¤ºä¾ï¼pjjylb_add.jsp/pjjylb_edit.jsp
var stralerts;
var types;
var windowtypes;
function onCheckAdsuOnly(type,windowtype,tableName,coloumName1,coloumName2,whereString,stralert){
		stralerts = stralert;
		types = type;
		windowtypes = windowtype;
		dwrMonitor.getDataList(tableName,coloumName1,coloumName2,whereString,getDataResult2); 
}
function getDataResult2(dataList){
      if(dataList.length >0){
      	if(windowtypes == "alert"){
      		alert(stralerts);
      	}
      	if(windowtypes == "confirm"){
      		if(confirm(stralerts)){
      			if(types == "add"){
       			submitAdd('null');
       			}
		       	if(types == "update"){
		       		submitEdit('null');
		       	}
      		}
      	}
      }else{ 
      	if(types == "add"){
       		submitAdd('null');
       	}
       	if(types == "update"){
       		submitEdit('null');
       	}
      } 
} 
function onCheckAdsuOnlys(windowtype,tableName,coloumName1,coloumName2,whereString,stralert){
		stralerts = stralert; 
		windowtypes = windowtype;
		dwrMonitor.getDataList(tableName,coloumName1,coloumName2,whereString,getDataResult2s); 
}
function getDataResult2s(dataList){
      if(dataList.length >0){
      	if(windowtypes == "alert"){
      		alert(stralerts);
      	}
      	if(windowtypes == "confirm"){
      		if(confirm(stralerts)){
      		}
      	}
      } 
      alert(ir);
} 



//éªè¯å¼è¯¾å¨æ¬¡
function isKkZc(str)
{
	//var kkZcReg=/^(\d?,?-?\d?)+$/;
	str=trim(str);
	if(str.indexOf("ï¼")!=-1){
		return false;
	}
	var kkZcReg=/^(\d+||\d+-\d+)((,\d+-\d+)*||(,\d+)*)((,\d+)||(,\d+-\d+))?$/;
	//var kkZcReg=/^(\d+||\d+-\d+)((((,\d)+-\d)+)*||(,\d+)*)((,\d+)||(,\d+-\d+))?$/;
    /*if (!kkZcReg.test(str)) 
    {
    	alert(1);
    	return false;
    }*/
    if(issmalltobigKKzc(str))
    {
       if(!isReKKzc(str))
       {
        return false;
       }
    }
    else
    {
     return false;
    }
    
	return true;
}

//ä¸¥æ´å¨æ¬¡æ¯å¦æéå¤ç
function isReKKzc(str)
{
   /**
     * å° 1-4,6,8-10,13è½¬æ¢æ 1,2,3,4,6,8,9,10,13
     * @param str
     * @return
     */
    
    var tempstr= ReserveConvertKkzc(str);
    var templist=tempstr.split(",");
    var tempstrequal=","+tempstr+",";
    //å¾ªç¯æ£æµæ¯å¦æéå¤ç 
    for(var i=0;i<templist.length;i++)
    {
      var equalstr=","+templist[i]+",";
      var starnum=tempstrequal.indexOf(equalstr);
      var endnum=tempstrequal.lastIndexOf(equalstr);
      if(starnum!=endnum)
      {
       return  false;
      }
    
    }
    
    
    return true;
   
}



//æ£æµç±»ä¼¼1-5ï¼å¸¦â-âæ¨¡å¼çåæ°æ¯å¦å°äºåæ° éè¦å¨éå¤æ£æ¥çåé¢
function issmalltobigKKzc(str)
{
  var templist=str.split(",");
   for(var i=0;i<templist.length;i++)
    {
      var oneStrList = templist[i].split("-");
		    	if (oneStrList.length > 1)
		    	{
		    		if(parseInt(oneStrList[0])>=parseInt(oneStrList[1]))
		    		{
		    			 return false;
		    		}
		    	}
    
    }
return  true;
}

//æ£æµå¨æ¬¡æ¯å¦å«ç¸åºçååå¨æ¬¡ flag=1ä¸ºå¥æ°ï¼flag=2ä¸ºå¶æ° 
function isdsKKzc(str,flag)
{
  var templist=str.split(",");
   for(var i=0;i<templist.length;i++)
    {
      var oneStrList = templist[i].split("-");
		    	if (oneStrList.length > 1||flag=='0')
		    	{
		    		return true;
		    	}
               else
               {
                 if(flag=='1')
                 {
                     if(parseInt(oneStrList)%2!=0)
                     return true;
                 }
                 else 
                 {
                   if(parseInt(oneStrList)%2==0)
                   {
                    return true;
                   }
                 }
                 
                 
               }
    }
return  false;
}

function getMaxKKzc(str,maxZc)
{
  /**
     * å° 1-4,6,8-10,13è½¬æ¢æ 1,2,3,4,6,8,9,10,13
     * @param str
     * @return
     */
    var tempmax=1;
    var tempstr= ReserveConvertKkzc(str);
    var templist=tempstr.split(",");
    var tempstrequal=","+tempstr+",";
    
    for(var i=0;i<templist.length;i++)
    {
      var equalstr=parseInt(templist[i]);
      if(equalstr>tempmax)
      {
      tempmax=equalstr;
      }
     
    
    }
  
    if(tempmax>parseInt(maxZc))
    {
     alert("è¯·ä¿è¯å¨æ¬¡æ°æå¤§ä¸è¶è¿"+maxZc+"ï¼");
     return false;
    }
    
    return true;
  }
//éªè¯çµè¯æ ¼å¼
function ValidatePhoneNum(obj){
	if (obj.value == "") return false;
    	var phoneReg=/^((\d{11})|^((\d{7,8})|(\d{4}|\d{3})-(\d{7,8})|(\d{4}|\d{3})-(\d{7,8})-(\d{4}|\d{3}|\d{2}|\d{1})|(\d{7,8})-(\d{4}|\d{3}|\d{2}|\d{1}))$)$/;
    	if (!phoneReg.test(obj.value)) {
		alert("çµè¯æ ¼å¼éè¯¯ï¼\n\næ­£ç¡®æ ¼å¼ï¼ä¾å¦ï¼\nåºè¯ï¼1234-12345678\nåºè¯å¸¦åæºï¼1234-12345678-1234\nææºï¼12345678901");
		obj.value = "";
		obj.focus();
		obj.select();
		return false;
	}
	return true;
}  

//éªè¯ä¸è½è¾å¥ç¹æ®å­ç¬¦
function checkInput(obj){
var stringReg =",./?;:'\"\|%ï¼ããï¼ï¼ï¼â\â%&ï¿¥";
if (obj.value == "") return false;
   for(var i = 0; i < obj.value.length; i++)//å­ç¬¦ä¸²strä¸­çå­ç¬¦ 
    {
	    var c1 = obj.value.charAt(i);
	    if(stringReg.indexOf(c1) > -1){
		alert("ä¸è½è¾å¥,./?;:'\"\|%");
		}
	}

}
function mxhDivOnscroll(obj){
isscroll=true;
javascript:document.getElementById('tblHeadDiv').style.pixelLeft = -obj.scrollLeft;
/*document.getElementById('cwhdiv').style.left = document.getElementById('alldiv').offsetWidth - 20 + this.scrollLeft;*/

}
var isdown=false;
var isscroll=false;
function mxhDivonmousedown(){
isdown=true;
//alert(2);
}
function mxhDivonmouseup(){
isdown=false;
if(isscroll){
//alert(1);
}
isscroll=false;
}

//åè¡¨å³å»èå
function csMenu() {
    this.IEventHander = null;
    this.IContextMenuHander = null;
    this.IStartIndex = null;
    this._menu = null;
    this._iframe = null;
    this._object = null;

    this.Show = function() {
        var e = window.event || event;
        if (e.button == 2) {
            this.IContextMenuHander = function(){return false;};
            document.attachEvent("oncontextmenu", this.IContextMenuHander);
            window.csMenu$Object = this;
            this.IEventHander = function(){window.csMenu$Object.Hide();};
            document.attachEvent("onmousedown", this.IEventHander);

			var tr = e.srcElement;
            if (tr.nodeName == 'TABLE') return;
            while (tr.nodeName != 'TR') tr = tr.parentNode;
            tr.onclick();
            var tds = tr.cells;
            var h = "<table height=" + tr.height + "px width='120px' cellpadding=0 cellspacing=0  style='border:1 solid buttonface;border:2 outset buttonhighlight;margin-top:-8px;margin-left:-8px;margin-right:-8px;margin-bottom:-8px;'>"; 
            h += "<tr  onMouseOver =\"this.style.backgroundColor='#C4DEFD'\"  onMouseOut =\"this.style.backgroundColor='#FFF'\">";
            for (var i = this.IStartIndex; i < tds.length; i++) {
            	var j = tds[i].outerHTML.indexOf('onclick="') + 9;
				h += tds[i].outerHTML.substring(0, j);
				h += "window.csMenu$Object._iframe.style.display = 'none'; ";
				h += "window.csMenu$Object._menu.style.display = 'none'; ";
				h += tds[i].outerHTML.substring(j);
				if( i < tds.length - 1){
					h += "</tr><tr  onMouseOver =\"this.style.backgroundColor='#C4DEFD'\"  onMouseOut =\"this.style.backgroundColor='#FFF'\" >";
				} 
			}
            h += "</tr></table>"; 
            this._menu.innerHTML = h;             
            this._menu.style.left = e.clientX;
            this._menu.style.top = e.clientY;
            this._menu.style.display = "";
                        
            var ifrmTop = e.clientY;
            var ifrmLeft = e.clientX;
            var ifrmWidth = this._menu.offsetWidth;
            var ifrmHeight = this._menu.offsetHeight;
            
            var scrollHeight = document.body.scrollHeight;
            var scrollWidth = document.body.scrollWidth; 
            if(e.clientY + this._menu.offsetHeight > scrollHeight){
            	 ifrmTop = ifrmTop - ifrmHeight;
            	 this._menu.style.top = ifrmTop;
            }
            
            if(e.clientX + this._menu.offsetWidth > scrollWidth ){
            	ifrmLeft = ifrmLeft - ifrmWidth;
            	this._menu.style.left = ifrmLeft;
            }
            
            this._iframe.style.left = ifrmLeft;
            this._iframe.style.top = ifrmTop;
           	this._iframe.style.height = ifrmHeight;
            this._iframe.style.width = ifrmWidth;
            this._iframe.style.display = "";
            //window.scrollTo(0,document.body.scrollHeight);
            
        }
    };

    this.Hide = function() {
        var e = window.event || event;
        var _element = e.srcElement;
        do {
            if (_element == this._menu)
                return false;
        }
        while ((_element = _element.offsetParent));
		document.detachEvent("on" + e.type, this.IEventHander);
        this._iframe.style.display = "none";
        this._menu.style.display = "none";
		document.detachEvent("oncontextmenu", this.IContextMenuHander);
    };

    this.initialize = function() {  
    	this._object = document.getElementById("mxh");
        window._csMenu$Object = this;
        var _eventHander = function(){window._csMenu$Object.Show();};
        this._object.attachEvent("onmouseup", _eventHander);
		document.getElementById('creating').onpropertychange = function() {
			if (event.propertyName == "style.visibility")
				if (event.srcElement["style"]["visibility"] == "visible") 
					window._csMenu$Object._object.detachEvent("onmouseup", _eventHander);
		}
		document.getElementById('hiddenframe').onreadystatechange = function() {
			if (this.readyState && this.readyState == 'complete') {
				window._csMenu$Object.Hide();
				if(document.getElementById("mxh") != window._csMenu$Object._object) {
					window._csMenu$Object._object = document.getElementById("mxh");
					window._csMenu$Object._object.attachEvent("onmouseup", _eventHander);
					window._csMenu$Object.IStartIndex = document.getElementById("tblHead").rows[0].cells.length - 1;
				}
			}
		}
		this.IStartIndex = document.getElementById("tblHead").rows[0].cells.length - 1;
		
        this._menu = document.createElement('div');
        document.body.insertBefore(this._menu, document.body.firstChild);
        this._menu.setAttribute("id", "menu_div"); 
        this._menu.style.border = "1px solid #cccccc";
        this._menu.style.backgroundColor = "white";
        this._menu.style.padding = "8px";
        this._menu.style.position = "absolute";
     	this._menu.style.display = "none";
     	this._menu.style.zIndex = "1000000";
     	
        this._iframe = document.createElement('iframe');
 	    document.body.insertBefore(this._iframe, document.body.firstChild);
 	    this._iframe.setAttribute("id", "menu_iframe"); 
 	    this._iframe.style.position = "absolute";
        this._iframe.style.display = "none";
        this._iframe.style.zIndex = "999999";
        this._iframe.style.border = "0px";
        this._iframe.style.height = "0px";
        this._iframe.style.width = "0px";    
    };

    this.initialize();
}

document.onreadystatechange = function() {
	if (document.readyState == "complete") {
		var _object = document.getElementById("tblHead");
		if(_object != undefined) {
			var tds = _object.rows[0].cells;
			if(tds[tds.length - 1].innerText == " æä½")
				new csMenu();
		}
	}
}


function getCheckedElement(obj) {
	var vStrType = Object.prototype.toString.apply(obj);
	if (vStrType == "[object String]") {
		var vObjArray = document.getElementsByName(obj);
		if (vObjArray.length > 0) {
			return vObjArray[0];
		}
	} else if (vStrType == "[object Object]") {
		return obj;
	}
	return null;
}

function checkStringLenB(obj,msg,len,needFocus,needSelect){
	var vObj = getCheckedElement(obj);
	if (!vObj) {
		window.alert("åæ°éè¯¯ï¼æ ¹æ®åæ° obj è·åä¸å°ææ¡£å¯¹è±¡ã");
		return false;
	}
	
	var vIntLength = len;
	if (len == null) {
		vIntLength = obj.maxLength;
	}
	
	if (null == vIntLength) {
		window.alert("æ¾ä¸å°éè¦æ£æ¥çæå¤§é¿åº¦ï¼len æè obj.maxLength å¶ä¸­ä¸ä¸ªå¿é¡»è¦æå¼ï¼ã");
		return false;
	}
	
	var vObjValue = vObj.value;
	vObjValue == (null != vObjValue) ? vObjValue : "";
	
	var vIntStrLengthB = vObjValue.replace(/[\u4e00-\u9fa5]/g, "xx").length;
   	if(vIntStrLengthB > len){
   		window.alert(msg+"çé¿åº¦è¶è¿äº"+len+"ä¸ªå­èï¼æ±å­å ä¸¤ä¸ªå­èï¼ã");
   		if (needFocus) vObj.focus();
   		if (needSelect) vObj.select();
   		return false;
   	}
  	return true;
}

// å¯¼åºDBFéç¨æ¹æ³
var newwin_dbfCommonExport = null;
function commonExport(title, root, fileId, param) {
	if(newwin_dbfCommonExport){
		newwin_dbfCommonExport.close();
	}
	
	htmlurl = root+"/DBFServlet";
	try {
	/*
		var xmlhttp = null;
		if (window.ActiveXObject) {
			xmlhttp = new ActiveXObject("MiCROSOFT.XMLHTTP");
		}
		else {
			xmlhttp = new XMLHttpRequest();
		}
		
		var paramURL = "&fileId=" + fileId;
		for (var prop in param) {
			if (param.hasOwnProperty(prop)) {
				paramURL += "&"+prop+"="+param[prop];
			}
		}
		
		xmlhttp.open("post", htmlurl);
		xmlhttp.setRequestHeader("content-type", "application/x-www-form-urlencoded");
		xmlhttp.send(paramURL);
		xmlhttp.onreadystatechange = function() {
			if (xmlhttp.status == 200) {
				window.alert(xmlhttp.getAllResponseHeaders());
			}
		}
	*/
	
		var oDiv = document.getElementById("commonExportDiv");
		if (oDiv) {
			document.body.removeChild(oDiv);
		}
		oDiv = document.createElement("<div id='commonExportDiv'>");
		oDiv.style.display = "none";

		var oForm = document.createElement("<form name='commonExportForm' method='post'>");
		var oHidden = null;
		for (var prop in param) {
			if (param.hasOwnProperty(prop)) {
				oHidden = document.createElement("<input type='hidden' name='"+prop+"'>");
				oHidden.value = param[prop];
				
				oForm.appendChild(oHidden);
			}
		}
		
		oHidden = document.createElement("<input type='hidden' name='fileId'>");
		oHidden.value = fileId;
		oForm.appendChild(oHidden);
		
		oHidden = document.createElement("<input type='hidden' name='title'>");
		oHidden.value = title;
		oForm.appendChild(oHidden);
				
		var oFrame = document.createElement("<iframe name='commonExportFrame' style='display:none'>");
		oDiv.appendChild(oForm);
		oDiv.appendChild(oFrame);
		document.body.appendChild(oDiv);
		
		document.forms['commonExportForm'].target = "commonExportFrame";
		alert(htmlurl);
		document.forms['commonExportForm'].action = htmlurl;
		document.forms['commonExportForm'].submit();
		
	} catch (e) {
		window.alert(e.description);
	}
}

function mJsMod(htmlurl,tmpWidth,tmpHeight){
	htmlurl=getRandomUrl(htmlurl);
	var newwin = window.showModalDialog(htmlurl,window,"dialogWidth:"+tmpWidth+"px;status:no;resizable:yes;dialogHeight:"+tmpHeight+"px");
	if (newwin != null && newwin == "ok"){
	    window.Form1.action="";
	    window.Form1.submit();	    
	}
}

function JsModless(htmlurl,tmpWidth,tmpHeight){
	htmlurl=getRandomUrl(htmlurl);
	var newwin = window.showModelessDialog(htmlurl,window,"dialogWidth:"+tmpWidth+"px;status:no;resizable:yes;dialogHeight:"+tmpHeight+"px");	
}
