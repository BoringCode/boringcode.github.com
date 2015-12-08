(function(window, document, undefined) {
	"use strict";

	//nav toggle
	document.querySelector(".nav-toggle").addEventListener("click", function(event) {
		event.target.classList.toggle('toggled');
	})

	/* Trianglify */
	var canvas = document.getElementById('triangle-target');
	var parent = canvas.parentNode;

	var pattern = Trianglify({
		width: parent.offsetWidth,
		height: parent.offsetHeight * 1.5,
		cell_size: 80,
		//seed: document.title, 
		//x_colors: ['#FFFFFF', '#16577d'],
	});

	pattern.canvas(canvas);

	var siteCode = document.querySelector(".site-code");
	if (siteCode) {
		var markup = document.documentElement.innerHTML;
		siteCode.textContent = markup;
		Prism.highlightElement(siteCode); 
	}
	 
	//WHUT?
	var spinning={element:null,toggled:false,init:function(a){var b=this;b.element=document.querySelectorAll(a);return b;},keydown:function(b){var a=april;if(b.keyCode===32){for(i=0;i<a.element.length;i++){a.element[i].classList.toggle("spin");}b.preventDefault();}}};var today=new Date;if(today.getMonth()===3&&today.getDate()===1){var april=spinning.init("body");document.addEventListener("keydown",april.keydown,false);}

}(window, document));