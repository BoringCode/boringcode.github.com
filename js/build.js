
/* **********************************************
     Begin prism-core.js
********************************************** */

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;

var _ = _self.Prism = {
	util: {
		encode: function (tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
			} else if (_.util.type(tokens) === 'Array') {
				return tokens.map(_.util.encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		type: function (o) {
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
		},

		// Deep clone a language definition (e.g. to extend it)
		clone: function (o) {
			var type = _.util.type(o);

			switch (type) {
				case 'Object':
					var clone = {};

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = _.util.clone(o[key]);
						}
					}

					return clone;

				case 'Array':
					// Check for existence for IE8
					return o.map && o.map(function(v) { return _.util.clone(v); });
			}

			return o;
		}
	},

	languages: {
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * Insert a token before another token in a language literal
		 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
		 * we cannot just provide an object, we need anobject and a key.
		 * @param inside The key (or language id) of the parent
		 * @param before The key to insert before. If not provided, the function appends instead.
		 * @param insert Object with the key/value pairs to insert
		 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];
			
			if (arguments.length == 2) {
				insert = arguments[1];
				
				for (var newToken in insert) {
					if (insert.hasOwnProperty(newToken)) {
						grammar[newToken] = insert[newToken];
					}
				}
				
				return grammar;
			}
			
			var ret = {};

			for (var token in grammar) {

				if (grammar.hasOwnProperty(token)) {

					if (token == before) {

						for (var newToken in insert) {

							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					ret[token] = grammar[token];
				}
			}
			
			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === root[inside] && key != inside) {
					this[key] = ret;
				}
			});

			return root[inside] = ret;
		},

		// Traverse a language definition with Depth First Search
		DFS: function(o, callback, type) {
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					if (_.util.type(o[i]) === 'Object') {
						_.languages.DFS(o[i], callback);
					}
					else if (_.util.type(o[i]) === 'Array') {
						_.languages.DFS(o[i], callback, i);
					}
				}
			}
		}
	},
	plugins: {},
	
	highlightAll: function(async, callback) {
		var elements = document.querySelectorAll('code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code');

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, callback);
		}
	},

	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;

		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}

		if (parent) {
			language = (parent.className.match(lang) || [,''])[1];
			grammar = _.languages[language];
		}

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		// Set language on the parent, for styling
		parent = element.parentNode;

		if (/pre/i.test(parent.nodeName)) {
			parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		if (!code || !grammar) {
			_.hooks.run('complete', env);
			return;
		}

		_.hooks.run('before-highlight', env);

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				env.highlightedCode = evt.data;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(env.element);
				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

			_.hooks.run('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			callback && callback.call(element);

			_.hooks.run('after-highlight', env);
			_.hooks.run('complete', env);
		}
	},

	highlight: function (text, grammar, language) {
		var tokens = _.tokenize(text, grammar);
		return Token.stringify(_.util.encode(tokens), language);
	},

	tokenize: function(text, grammar, language) {
		var Token = _.Token;

		var strarr = [text];

		var rest = grammar.rest;

		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		tokenloop: for (var token in grammar) {
			if(!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			var patterns = grammar[token];
			patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var pattern = patterns[j],
					inside = pattern.inside,
					lookbehind = !!pattern.lookbehind,
					lookbehindLength = 0,
					alias = pattern.alias;

				pattern = pattern.pattern || pattern;

				for (var i=0; i<strarr.length; i++) { // Don’t cache length as it changes during the loop

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						break tokenloop;
					}

					if (str instanceof Token) {
						continue;
					}

					pattern.lastIndex = 0;

					var match = pattern.exec(str);

					if (match) {
						if(lookbehind) {
							lookbehindLength = match[1].length;
						}

						var from = match.index - 1 + lookbehindLength,
							match = match[0].slice(lookbehindLength),
							len = match.length,
							to = from + len,
							before = str.slice(0, from + 1),
							after = str.slice(to + 1);

						var args = [i, 1];

						if (before) {
							args.push(before);
						}

						var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias);

						args.push(wrapped);

						if (after) {
							args.push(after);
						}

						Array.prototype.splice.apply(strarr, args);
					}
				}
			}
		}

		return strarr;
	},

	hooks: {
		all: {},

		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	}
};

var Token = _.Token = function(type, content, alias) {
	this.type = type;
	this.content = content;
	this.alias = alias;
};

Token.stringify = function(o, language, parent) {
	if (typeof o == 'string') {
		return o;
	}

	if (_.util.type(o) === 'Array') {
		return o.map(function(element) {
			return Token.stringify(element, language, o);
		}).join('');
	}

	var env = {
		type: o.type,
		content: Token.stringify(o.content, language, parent),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language,
		parent: parent
	};

	if (env.type == 'comment') {
		env.attributes['spellcheck'] = 'true';
	}

	if (o.alias) {
		var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
		Array.prototype.push.apply(env.classes, aliases);
	}

	_.hooks.run('wrap', env);

	var attributes = '';

	for (var name in env.attributes) {
		attributes += (attributes ? ' ' : '') + name + '="' + (env.attributes[name] || '') + '"';
	}

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '" ' + attributes + '>' + env.content + '</' + env.tag + '>';

};

if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _self.Prism;
	}
 	// In worker
	_self.addEventListener('message', function(evt) {
		var message = JSON.parse(evt.data),
		    lang = message.language,
		    code = message.code,
		    immediateClose = message.immediateClose;

		_self.postMessage(_.highlight(code, _.languages[lang], lang));
		if (immediateClose) {
			_self.close();
		}
	}, false);

	return _self.Prism;
}

// Get current script and highlight
var script = document.getElementsByTagName('script');

script = script[script.length - 1];

if (script) {
	_.filename = script.src;

	if (document.addEventListener && !script.hasAttribute('data-manual')) {
		document.addEventListener('DOMContentLoaded', _.highlightAll);
	}
}

return _self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}


/* **********************************************
     Begin prism-markup.js
********************************************** */

Prism.languages.markup = {
	'comment': /<!--[\w\W]*?-->/,
	'prolog': /<\?[\w\W]+?\?>/,
	'doctype': /<!DOCTYPE[\w\W]+?>/,
	'cdata': /<!\[CDATA\[[\w\W]*?]]>/i,
	'tag': {
		pattern: /<\/?(?!\d)[^\s>\/=.$<]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\\1|\\?(?!\1)[\w\W])*\1|[^\s'">=]+))?)*\s*\/?>/i,
		inside: {
			'tag': {
				pattern: /^<\/?[^\s>\/]+/i,
				inside: {
					'punctuation': /^<\/?/,
					'namespace': /^[^\s>\/:]+:/
				}
			},
			'attr-value': {
				pattern: /=(?:('|")[\w\W]*?(\1)|[^\s>]+)/i,
				inside: {
					'punctuation': /[=>"']/
				}
			},
			'punctuation': /\/?>/,
			'attr-name': {
				pattern: /[^\s>\/]+/,
				inside: {
					'namespace': /^[^\s>\/:]+:/
				}
			}

		}
	},
	'entity': /&#?[\da-z]{1,8};/i
};

// Plugin to make entity title show the real entity, idea by Roman Komarov
Prism.hooks.add('wrap', function(env) {

	if (env.type === 'entity') {
		env.attributes['title'] = env.content.replace(/&amp;/, '&');
	}
});

Prism.languages.xml = Prism.languages.markup;
Prism.languages.html = Prism.languages.markup;
Prism.languages.mathml = Prism.languages.markup;
Prism.languages.svg = Prism.languages.markup;


/* **********************************************
     Begin prism-css.js
********************************************** */

Prism.languages.css = {
	'comment': /\/\*[\w\W]*?\*\//,
	'atrule': {
		pattern: /@[\w-]+?.*?(;|(?=\s*\{))/i,
		inside: {
			'rule': /@[\w-]+/
			// See rest below
		}
	},
	'url': /url\((?:(["'])(\\(?:\r\n|[\w\W])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
	'selector': /[^\{\}\s][^\{\};]*?(?=\s*\{)/,
	'string': /("|')(\\(?:\r\n|[\w\W])|(?!\1)[^\\\r\n])*\1/,
	'property': /(\b|\B)[\w-]+(?=\s*:)/i,
	'important': /\B!important\b/i,
	'function': /[-a-z0-9]+(?=\()/i,
	'punctuation': /[(){};:]/
};

Prism.languages.css['atrule'].inside.rest = Prism.util.clone(Prism.languages.css);

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'style': {
			pattern: /(<style[\w\W]*?>)[\w\W]*?(?=<\/style>)/i,
			lookbehind: true,
			inside: Prism.languages.css,
			alias: 'language-css'
		}
	});
	
	Prism.languages.insertBefore('inside', 'attr-value', {
		'style-attr': {
			pattern: /\s*style=("|').*?\1/i,
			inside: {
				'attr-name': {
					pattern: /^\s*style/i,
					inside: Prism.languages.markup.tag.inside
				},
				'punctuation': /^\s*=\s*['"]|['"]\s*$/,
				'attr-value': {
					pattern: /.+/i,
					inside: Prism.languages.css
				}
			},
			alias: 'language-css'
		}
	}, Prism.languages.markup.tag);
}

/* **********************************************
     Begin prism-clike.js
********************************************** */

Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\w\W]*?\*\//,
			lookbehind: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true
		}
	],
	'string': /(["'])(\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
	'class-name': {
		pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[a-z0-9_\.\\]+/i,
		lookbehind: true,
		inside: {
			punctuation: /(\.|\\)/
		}
	},
	'keyword': /\b(if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
	'boolean': /\b(true|false)\b/,
	'function': /[a-z0-9_]+(?=\()/i,
	'number': /\b-?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)\b/i,
	'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
	'punctuation': /[{}[\];(),.:]/
};


/* **********************************************
     Begin prism-javascript.js
********************************************** */

Prism.languages.javascript = Prism.languages.extend('clike', {
	'keyword': /\b(as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
	'number': /\b-?(0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d*\.?\d+([Ee][+-]?\d+)?|NaN|Infinity)\b/,
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*(?=\()/i
});

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\\\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
		lookbehind: true
	}
});

Prism.languages.insertBefore('javascript', 'class-name', {
	'template-string': {
		pattern: /`(?:\\`|\\?[^`])*`/,
		inside: {
			'interpolation': {
				pattern: /\$\{[^}]+\}/,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	}
});

if (Prism.languages.markup) {
	Prism.languages.insertBefore('markup', 'tag', {
		'script': {
			pattern: /(<script[\w\W]*?>)[\w\W]*?(?=<\/script>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript,
			alias: 'language-javascript'
		}
	});
}

Prism.languages.js = Prism.languages.javascript;

/* **********************************************
     Begin prism-file-highlight.js
********************************************** */

(function () {
	if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
		return;
	}

	self.Prism.fileHighlight = function() {

		var Extensions = {
			'js': 'javascript',
			'html': 'markup',
			'svg': 'markup',
			'xml': 'markup',
			'py': 'python',
			'rb': 'ruby',
			'ps1': 'powershell',
			'psm1': 'powershell'
		};

		if(Array.prototype.forEach) { // Check to prevent error in IE8
			Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function (pre) {
				var src = pre.getAttribute('data-src');

				var language, parent = pre;
				var lang = /\blang(?:uage)?-(?!\*)(\w+)\b/i;
				while (parent && !lang.test(parent.className)) {
					parent = parent.parentNode;
				}

				if (parent) {
					language = (pre.className.match(lang) || [, ''])[1];
				}

				if (!language) {
					var extension = (src.match(/\.(\w+)$/) || [, ''])[1];
					language = Extensions[extension] || extension;
				}

				var code = document.createElement('code');
				code.className = 'language-' + language;

				pre.textContent = '';

				code.textContent = 'Loading…';

				pre.appendChild(code);

				var xhr = new XMLHttpRequest();

				xhr.open('GET', src, true);

				xhr.onreadystatechange = function () {
					if (xhr.readyState == 4) {

						if (xhr.status < 400 && xhr.responseText) {
							code.textContent = xhr.responseText;

							Prism.highlightElement(code);
						}
						else if (xhr.status >= 400) {
							code.textContent = '✖ Error ' + xhr.status + ' while fetching file: ' + xhr.statusText;
						}
						else {
							code.textContent = '✖ Error: File does not exist or is empty';
						}
					}
				};

				xhr.send(null);
			});
		}

	};

	self.Prism.fileHighlight();

})();

!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var r;r="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,r.Trianglify=e()}}(function(){var e;return function r(e,n,t){function f(a,i){if(!n[a]){if(!e[a]){var c="function"==typeof require&&require;if(!i&&c)return c(a,!0);if(o)return o(a,!0);var u=new Error("Cannot find module '"+a+"'");throw u.code="MODULE_NOT_FOUND",u}var d=n[a]={exports:{}};e[a][0].call(d.exports,function(r){var n=e[a][1][r];return f(n?n:r)},d,d.exports,r,e,n,t)}return n[a].exports}for(var o="function"==typeof require&&require,a=0;a<t.length;a++)f(t[a]);return f}({"./lib/trianglify.js":[function(e,r){function n(e){function r(e,r,n){return(e-r[0])*(n[1]-n[0])/(r[1]-r[0])+n[0]}function n(n,t){for(var f=[],o=-y;n+y>o;o+=e.cell_size)for(var a=-v;t+v>a;a+=e.cell_size){var i=o+e.cell_size/2+r(rand(),[0,1],[-w,w]),c=a+e.cell_size/2+r(rand(),[0,1],[-w,w]);f.push([i,c].map(Math.floor))}return f}function a(e){return{x:(e[0][0]+e[1][0]+e[2][0])/3,y:(e[0][1]+e[1][1]+e[2][1])/3}}function u(){if(e.palette instanceof Array)return e.palette[Math.floor(rand()*e.palette.length)];var r=Object.keys(e.palette);return e.palette[r[Math.floor(rand()*r.length)]]}function d(e,r){var n={};for(var t in e)n[t]=e[t];for(t in r){if(!e.hasOwnProperty(t))throw new Error(t+" is not a configuration option for Trianglify. Check your spelling?");n[t]=r[t]}return n}if(e=d(c,e),rand=f(e.seed),"random"===e.x_colors&&(e.x_colors=u()),"random"===e.y_colors&&(e.y_colors=u()),"match_x"===e.y_colors&&(e.y_colors=e.x_colors),!(e.width>0&&e.height>0))throw new Error("Width and height must be numbers greater than 0");if(e.cell_size<2)throw new Error("Cell size must be greater than 2.");var s;if(e.color_function)s=function(r,n){return o(e.color_function(r,n))};else{var l=o.scale(e.x_colors).mode(e.color_space),b=o.scale(e.y_colors).mode(e.color_space);s=function(r,n){return o.interpolate(l(r),b(n),.5,e.color_space)}}for(var h=e.width,g=e.height,p=Math.floor((h+4*e.cell_size)/e.cell_size),m=Math.floor((g+4*e.cell_size)/e.cell_size),y=(p*e.cell_size-h)/2,v=(m*e.cell_size-g)/2,w=e.cell_size*e.variance/2,x=function(e){return r(e,[-y,h+y],[0,1])},_=function(e){return r(e,[-v,g+v],[0,1])},k=n(h,g),j=t.triangulate(k),M=[],q=function(e){return k[e]},C=0;C<j.length;C+=3){var N=[j[C],j[C+1],j[C+2]].map(q),U=a(N),A=s(x(U.x),_(U.y)).hex();M.push([A,N])}return i(M,e)}var t=e("delaunay-fast"),f=e("seedrandom"),o=e("chroma-js"),a=e("./colorbrewer"),i=e("./pattern"),c={width:600,height:400,cell_size:75,variance:.75,seed:null,x_colors:"random",y_colors:"match_x",palette:a,color_space:"lab",color_function:null,stroke_width:1.51};n.colorbrewer=a,n.defaults=c,r.exports=n},{"./colorbrewer":"/Users/qrohlf/Code/trianglify/lib/colorbrewer.js","./pattern":"/Users/qrohlf/Code/trianglify/lib/pattern.js","chroma-js":"/Users/qrohlf/Code/trianglify/node_modules/chroma-js/chroma.js","delaunay-fast":"/Users/qrohlf/Code/trianglify/node_modules/delaunay-fast/delaunay.js",seedrandom:"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/index.js"}],"/Users/qrohlf/Code/trianglify/lib/colorbrewer.js":[function(e,r){r.exports={YlGn:["#ffffe5","#f7fcb9","#d9f0a3","#addd8e","#78c679","#41ab5d","#238443","#006837","#004529"],YlGnBu:["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"],GnBu:["#f7fcf0","#e0f3db","#ccebc5","#a8ddb5","#7bccc4","#4eb3d3","#2b8cbe","#0868ac","#084081"],BuGn:["#f7fcfd","#e5f5f9","#ccece6","#99d8c9","#66c2a4","#41ae76","#238b45","#006d2c","#00441b"],PuBuGn:["#fff7fb","#ece2f0","#d0d1e6","#a6bddb","#67a9cf","#3690c0","#02818a","#016c59","#014636"],PuBu:["#fff7fb","#ece7f2","#d0d1e6","#a6bddb","#74a9cf","#3690c0","#0570b0","#045a8d","#023858"],BuPu:["#f7fcfd","#e0ecf4","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#810f7c","#4d004b"],RdPu:["#fff7f3","#fde0dd","#fcc5c0","#fa9fb5","#f768a1","#dd3497","#ae017e","#7a0177","#49006a"],PuRd:["#f7f4f9","#e7e1ef","#d4b9da","#c994c7","#df65b0","#e7298a","#ce1256","#980043","#67001f"],OrRd:["#fff7ec","#fee8c8","#fdd49e","#fdbb84","#fc8d59","#ef6548","#d7301f","#b30000","#7f0000"],YlOrRd:["#ffffcc","#ffeda0","#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"],YlOrBr:["#ffffe5","#fff7bc","#fee391","#fec44f","#fe9929","#ec7014","#cc4c02","#993404","#662506"],Purples:["#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8","#807dba","#6a51a3","#54278f","#3f007d"],Blues:["#f7fbff","#deebf7","#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#08519c","#08306b"],Greens:["#f7fcf5","#e5f5e0","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#006d2c","#00441b"],Oranges:["#fff5eb","#fee6ce","#fdd0a2","#fdae6b","#fd8d3c","#f16913","#d94801","#a63603","#7f2704"],Reds:["#fff5f0","#fee0d2","#fcbba1","#fc9272","#fb6a4a","#ef3b2c","#cb181d","#a50f15","#67000d"],Greys:["#ffffff","#f0f0f0","#d9d9d9","#bdbdbd","#969696","#737373","#525252","#252525","#000000"],PuOr:["#7f3b08","#b35806","#e08214","#fdb863","#fee0b6","#f7f7f7","#d8daeb","#b2abd2","#8073ac","#542788","#2d004b"],BrBG:["#543005","#8c510a","#bf812d","#dfc27d","#f6e8c3","#f5f5f5","#c7eae5","#80cdc1","#35978f","#01665e","#003c30"],PRGn:["#40004b","#762a83","#9970ab","#c2a5cf","#e7d4e8","#f7f7f7","#d9f0d3","#a6dba0","#5aae61","#1b7837","#00441b"],PiYG:["#8e0152","#c51b7d","#de77ae","#f1b6da","#fde0ef","#f7f7f7","#e6f5d0","#b8e186","#7fbc41","#4d9221","#276419"],RdBu:["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#f7f7f7","#d1e5f0","#92c5de","#4393c3","#2166ac","#053061"],RdGy:["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#ffffff","#e0e0e0","#bababa","#878787","#4d4d4d","#1a1a1a"],RdYlBu:["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"],Spectral:["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"],RdYlGn:["#a50026","#d73027","#f46d43","#fdae61","#fee08b","#ffffbf","#d9ef8b","#a6d96a","#66bd63","#1a9850","#006837"]}},{}],"/Users/qrohlf/Code/trianglify/lib/pattern.js":[function(e,r){(function(n){function t(r,t){function o(){var e=f.createElementNS("http://www.w3.org/2000/svg","svg");return e.setAttribute("width",t.width),e.setAttribute("height",t.height),r.forEach(function(r){var n=f.createElementNS("http://www.w3.org/2000/svg","path");n.setAttribute("d","M"+r[1].join("L")+"Z"),n.setAttribute("fill",r[0]),n.setAttribute("stroke",r[0]),n.setAttribute("stroke-width",t.stroke_width),e.appendChild(n)}),e}function a(o){if("undefined"!=typeof n)try{e("canvas")}catch(a){throw Error("The optional node-canvas dependency is needed for Trianglify to render using canvas in node.")}return o||(o=f.createElement("canvas")),o.setAttribute("width",t.width),o.setAttribute("height",t.height),ctx=o.getContext("2d"),ctx.canvas.width=t.width,ctx.canvas.height=t.height,r.forEach(function(e){ctx.fillStyle=ctx.strokeStyle=e[0],ctx.lineWidth=t.stroke_width,ctx.beginPath(),ctx.moveTo.apply(ctx,e[1][0]),ctx.lineTo.apply(ctx,e[1][1]),ctx.lineTo.apply(ctx,e[1][2]),ctx.fill(),ctx.stroke()}),o}function i(){return a().toDataURL("image/png")}return{polys:r,opts:t,svg:o,canvas:a,png:i}}var f="undefined"!=typeof document?document:e("jsdom").jsdom("<html/>");r.exports=t}).call(this,e("_process"))},{_process:"/Users/qrohlf/Code/trianglify/node_modules/browserify/node_modules/process/browser.js",canvas:"/Users/qrohlf/Code/trianglify/node_modules/browserify/node_modules/browser-resolve/empty.js",jsdom:"/Users/qrohlf/Code/trianglify/node_modules/browserify/node_modules/browser-resolve/empty.js"}],"/Users/qrohlf/Code/trianglify/node_modules/browserify/node_modules/browser-resolve/empty.js":[function(){},{}],"/Users/qrohlf/Code/trianglify/node_modules/browserify/node_modules/process/browser.js":[function(e,r){function n(){if(!a){a=!0;for(var e,r=o.length;r;){e=o,o=[];for(var n=-1;++n<r;)e[n]();r=o.length}a=!1}}function t(){}var f=r.exports={},o=[],a=!1;f.nextTick=function(e){o.push(e),a||setTimeout(n,0)},f.title="browser",f.browser=!0,f.env={},f.argv=[],f.version="",f.versions={},f.on=t,f.addListener=t,f.once=t,f.off=t,f.removeListener=t,f.removeAllListeners=t,f.emit=t,f.binding=function(){throw new Error("process.binding is not supported")},f.cwd=function(){return"/"},f.chdir=function(){throw new Error("process.chdir is not supported")},f.umask=function(){return 0}},{}],"/Users/qrohlf/Code/trianglify/node_modules/chroma-js/chroma.js":[function(r,n,t){(function(){var r,f,o,a,i,c,u,d,s,l,b,h,g,p,m,y,v,w,x,_,k,j,M,q,C,N,U,A,P,z,G,E,B,I,R,S,O,T,Y;l=function(e,n,t,f){return new r(e,n,t,f)},"undefined"!=typeof n&&null!==n&&null!=n.exports&&(n.exports=l),"function"==typeof e&&e.amd?e([],function(){return l}):(I="undefined"!=typeof t&&null!==t?t:this,I.chroma=l),l.color=function(e,n,t,f){return new r(e,n,t,f)},l.hsl=function(e,n,t,f){return new r(e,n,t,f,"hsl")},l.hsv=function(e,n,t,f){return new r(e,n,t,f,"hsv")},l.rgb=function(e,n,t,f){return new r(e,n,t,f,"rgb")},l.hex=function(e){return new r(e)},l.css=function(e){return new r(e)},l.lab=function(e,n,t){return new r(e,n,t,"lab")},l.lch=function(e,n,t){return new r(e,n,t,"lch")},l.hsi=function(e,n,t){return new r(e,n,t,"hsi")},l.gl=function(e,n,t,f){return new r(255*e,255*n,255*t,f,"gl")},l.interpolate=function(e,n,t,f){return null==e||null==n?"#000":("string"===R(e)&&(e=new r(e)),"string"===R(n)&&(n=new r(n)),e.interpolate(t,n,f))},l.mix=l.interpolate,l.contrast=function(e,n){var t,f;return"string"===R(e)&&(e=new r(e)),"string"===R(n)&&(n=new r(n)),t=e.luminance(),f=n.luminance(),t>f?(t+.05)/(f+.05):(f+.05)/(t+.05)},l.luminance=function(e){return l(e).luminance()},l._Color=r,r=function(){function e(){var e,r,n,t,f,o,a,i,c,u,d,s,l,h,g,p;for(f=this,n=[],u=0,d=arguments.length;d>u;u++)r=arguments[u],null!=r&&n.push(r);if(0===n.length)s=[255,0,255,1,"rgb"],a=s[0],i=s[1],c=s[2],e=s[3],t=s[4];else if("array"===R(n[0])){if(3===n[0].length)l=n[0],a=l[0],i=l[1],c=l[2],e=1;else{if(4!==n[0].length)throw"unknown input argument";h=n[0],a=h[0],i=h[1],c=h[2],e=h[3]}t=null!=(g=n[1])?g:"rgb"}else"string"===R(n[0])?(a=n[0],t="hex"):"object"===R(n[0])?(p=n[0]._rgb,a=p[0],i=p[1],c=p[2],e=p[3],t="rgb"):n.length>=3&&(a=n[0],i=n[1],c=n[2]);3===n.length?(t="rgb",e=1):4===n.length?"string"===R(n[3])?(t=n[3],e=1):"number"===R(n[3])&&(t="rgb",e=n[3]):5===n.length&&(e=n[3],t=n[4]),null==e&&(e=1),"rgb"===t?f._rgb=[a,i,c,e]:"gl"===t?f._rgb=[255*a,255*i,255*c,e]:"hsl"===t?(f._rgb=v(a,i,c),f._rgb[3]=e):"hsv"===t?(f._rgb=w(a,i,c),f._rgb[3]=e):"hex"===t?f._rgb=m(a):"lab"===t?(f._rgb=_(a,i,c),f._rgb[3]=e):"lch"===t?(f._rgb=M(a,i,c),f._rgb[3]=e):"hsi"===t&&(f._rgb=y(a,i,c),f._rgb[3]=e),o=b(f._rgb)}return e.prototype.rgb=function(){return this._rgb.slice(0,3)},e.prototype.rgba=function(){return this._rgb},e.prototype.hex=function(){return U(this._rgb)},e.prototype.toString=function(){return this.name()},e.prototype.hsl=function(){return P(this._rgb)},e.prototype.hsv=function(){return z(this._rgb)},e.prototype.lab=function(){return G(this._rgb)},e.prototype.lch=function(){return E(this._rgb)},e.prototype.hsi=function(){return A(this._rgb)},e.prototype.gl=function(){return[this._rgb[0]/255,this._rgb[1]/255,this._rgb[2]/255,this._rgb[3]]},e.prototype.luminance=function(r,n){var t,f,o,a;return null==n&&(n="rgb"),arguments.length?(0===r&&(this._rgb=[0,0,0,this._rgb[3]]),1===r&&(this._rgb=[255,255,255,this._rgb[3]]),t=C(this._rgb),f=1e-7,o=20,a=function(e,t){var i,c;return c=e.interpolate(.5,t,n),i=c.luminance(),Math.abs(r-i)<f||!o--?c:i>r?a(e,c):a(c,t)},this._rgb=(t>r?a(new e("black"),this):a(this,new e("white"))).rgba(),this):C(this._rgb)},e.prototype.name=function(){var e,r;e=this.hex();for(r in l.colors)if(e===l.colors[r])return r;return e},e.prototype.alpha=function(e){return arguments.length?(this._rgb[3]=e,this):this._rgb[3]},e.prototype.css=function(e){var r,n,t,f;return null==e&&(e="rgb"),n=this,t=n._rgb,3===e.length&&t[3]<1&&(e+="a"),"rgb"===e?e+"("+t.slice(0,3).map(Math.round).join(",")+")":"rgba"===e?e+"("+t.slice(0,3).map(Math.round).join(",")+","+t[3]+")":"hsl"===e||"hsla"===e?(r=n.hsl(),f=function(e){return Math.round(100*e)/100},r[0]=f(r[0]),r[1]=f(100*r[1])+"%",r[2]=f(100*r[2])+"%",4===e.length&&(r[3]=t[3]),e+"("+r.join(",")+")"):void 0},e.prototype.interpolate=function(r,n,t){var f,o,a,i,c,u,d,s,l,b,h,g,p,m;if(s=this,null==t&&(t="rgb"),"string"===R(n)&&(n=new e(n)),"hsl"===t||"hsv"===t||"lch"===t||"hsi"===t)"hsl"===t?(p=s.hsl(),m=n.hsl()):"hsv"===t?(p=s.hsv(),m=n.hsv()):"hsi"===t?(p=s.hsi(),m=n.hsi()):"lch"===t&&(p=s.lch(),m=n.lch()),"h"===t.substr(0,1)?(a=p[0],h=p[1],u=p[2],i=m[0],g=m[1],d=m[2]):(u=p[0],h=p[1],a=p[2],d=m[0],g=m[1],i=m[2]),isNaN(a)||isNaN(i)?isNaN(a)?isNaN(i)?o=Number.NaN:(o=i,1!==u&&0!==u||"hsv"===t||(b=g)):(o=a,1!==d&&0!==d||"hsv"===t||(b=h)):(f=i>a&&i-a>180?i-(a+360):a>i&&a-i>180?i+360-a:i-a,o=a+r*f),null==b&&(b=h+r*(g-h)),c=u+r*(d-u),l="h"===t.substr(0,1)?new e(o,b,c,t):new e(c,b,o,t);else if("rgb"===t)p=s._rgb,m=n._rgb,l=new e(p[0]+r*(m[0]-p[0]),p[1]+r*(m[1]-p[1]),p[2]+r*(m[2]-p[2]),t);else{if("lab"!==t)throw"color mode "+t+" is not supported";p=s.lab(),m=n.lab(),l=new e(p[0]+r*(m[0]-p[0]),p[1]+r*(m[1]-p[1]),p[2]+r*(m[2]-p[2]),t)}return l.alpha(s.alpha()+r*(n.alpha()-s.alpha())),l},e.prototype.premultiply=function(){var e,r;return r=this.rgb(),e=this.alpha(),l(r[0]*e,r[1]*e,r[2]*e,e)},e.prototype.darken=function(e){var r,n;return null==e&&(e=20),n=this,r=n.lch(),r[0]-=e,l.lch(r).alpha(n.alpha())},e.prototype.darker=function(e){return this.darken(e)},e.prototype.brighten=function(e){return null==e&&(e=20),this.darken(-e)},e.prototype.brighter=function(e){return this.brighten(e)},e.prototype.saturate=function(e){var r,n;return null==e&&(e=20),n=this,r=n.lch(),r[1]+=e,l.lch(r).alpha(n.alpha())},e.prototype.desaturate=function(e){return null==e&&(e=20),this.saturate(-e)},e}(),b=function(e){var r;for(r in e)3>r?(e[r]<0&&(e[r]=0),e[r]>255&&(e[r]=255)):3===r&&(e[r]<0&&(e[r]=0),e[r]>1&&(e[r]=1));return e},p=function(e){var r,n,t,f,o,a,i,c;if(e=e.toLowerCase(),null!=l.colors&&l.colors[e])return m(l.colors[e]);if(t=e.match(/rgb\(\s*(\-?\d+),\s*(\-?\d+)\s*,\s*(\-?\d+)\s*\)/)){for(f=t.slice(1,4),n=o=0;2>=o;n=++o)f[n]=+f[n];f[3]=1}else if(t=e.match(/rgba\(\s*(\-?\d+),\s*(\-?\d+)\s*,\s*(\-?\d+)\s*,\s*([01]|[01]?\.\d+)\)/))for(f=t.slice(1,5),n=a=0;3>=a;n=++a)f[n]=+f[n];else if(t=e.match(/rgb\(\s*(\-?\d+(?:\.\d+)?)%,\s*(\-?\d+(?:\.\d+)?)%\s*,\s*(\-?\d+(?:\.\d+)?)%\s*\)/)){for(f=t.slice(1,4),n=i=0;2>=i;n=++i)f[n]=Math.round(2.55*f[n]);f[3]=1}else if(t=e.match(/rgba\(\s*(\-?\d+(?:\.\d+)?)%,\s*(\-?\d+(?:\.\d+)?)%\s*,\s*(\-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)/)){for(f=t.slice(1,5),n=c=0;2>=c;n=++c)f[n]=Math.round(2.55*f[n]);f[3]=+f[3]}else(t=e.match(/hsl\(\s*(\-?\d+(?:\.\d+)?),\s*(\-?\d+(?:\.\d+)?)%\s*,\s*(\-?\d+(?:\.\d+)?)%\s*\)/))?(r=t.slice(1,4),r[1]*=.01,r[2]*=.01,f=v(r),f[3]=1):(t=e.match(/hsla\(\s*(\-?\d+(?:\.\d+)?),\s*(\-?\d+(?:\.\d+)?)%\s*,\s*(\-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)/))&&(r=t.slice(1,4),r[1]*=.01,r[2]*=.01,f=v(r),f[3]=+t[4]);return f},m=function(e){var r,n,t,f,o,a;if(e.match(/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/))return(4===e.length||7===e.length)&&(e=e.substr(1)),3===e.length&&(e=e.split(""),e=e[0]+e[0]+e[1]+e[1]+e[2]+e[2]),a=parseInt(e,16),f=a>>16,t=a>>8&255,n=255&a,[f,t,n,1];if(e.match(/^#?([A-Fa-f0-9]{8})$/))return 9===e.length&&(e=e.substr(1)),a=parseInt(e,16),f=a>>24&255,t=a>>16&255,n=a>>8&255,r=255&a,[f,t,n,r];if(o=p(e))return o;throw"unknown color: "+e},y=function(e,r,n){var t,f,i,c;return c=S(arguments),e=c[0],r=c[1],n=c[2],e/=360,1/3>e?(t=(1-r)/3,i=(1+r*g(a*e)/g(o-a*e))/3,f=1-(t+i)):2/3>e?(e-=1/3,i=(1-r)/3,f=(1+r*g(a*e)/g(o-a*e))/3,t=1-(i+f)):(e-=2/3,f=(1-r)/3,t=(1+r*g(a*e)/g(o-a*e))/3,i=1-(f+t)),i=q(n*i*3),f=q(n*f*3),t=q(n*t*3),[255*i,255*f,255*t]},v=function(){var e,r,n,t,f,o,a,i,c,u,d,s,l,b;if(l=S(arguments),t=l[0],i=l[1],o=l[2],0===i)a=n=e=255*o;else{for(d=[0,0,0],r=[0,0,0],u=.5>o?o*(1+i):o+i-o*i,c=2*o-u,t/=360,d[0]=t+1/3,d[1]=t,d[2]=t-1/3,f=s=0;2>=s;f=++s)d[f]<0&&(d[f]+=1),d[f]>1&&(d[f]-=1),r[f]=6*d[f]<1?c+6*(u-c)*d[f]:2*d[f]<1?u:3*d[f]<2?c+(u-c)*(2/3-d[f])*6:c;b=[Math.round(255*r[0]),Math.round(255*r[1]),Math.round(255*r[2])],a=b[0],n=b[1],e=b[2]}return[a,n,e]},w=function(){var e,r,n,t,f,o,a,i,c,u,d,s,l,b,h,g,p,m;if(s=S(arguments),t=s[0],c=s[1],d=s[2],d*=255,0===c)i=n=e=d;else switch(360===t&&(t=0),t>360&&(t-=360),0>t&&(t+=360),t/=60,f=Math.floor(t),r=t-f,o=d*(1-c),a=d*(1-c*r),u=d*(1-c*(1-r)),f){case 0:l=[d,u,o],i=l[0],n=l[1],e=l[2];break;case 1:b=[a,d,o],i=b[0],n=b[1],e=b[2];break;case 2:h=[o,d,u],i=h[0],n=h[1],e=h[2];break;case 3:g=[o,a,d],i=g[0],n=g[1],e=g[2];break;case 4:p=[u,o,d],i=p[0],n=p[1],e=p[2];break;case 5:m=[d,o,a],i=m[0],n=m[1],e=m[2]}return i=Math.round(i),n=Math.round(n),e=Math.round(e),[i,n,e]},f=18,i=.95047,c=1,u=1.08883,x=function(){var e,r,n,t,f,o;return o=S(arguments),f=o[0],e=o[1],r=o[2],n=Math.sqrt(e*e+r*r),t=Math.atan2(r,e)/Math.PI*180,[f,n,t]},_=function(e,r,n){var t,f,o,a,d,s,l;return void 0!==e&&3===e.length&&(s=e,e=s[0],r=s[1],n=s[2]),void 0!==e&&3===e.length&&(l=e,e=l[0],r=l[1],n=l[2]),a=(e+16)/116,o=a+r/500,d=a-n/200,o=k(o)*i,a=k(a)*c,d=k(d)*u,f=T(3.2404542*o-1.5371385*a-.4985314*d),t=T(-.969266*o+1.8760108*a+.041556*d),n=T(.0556434*o-.2040259*a+1.0572252*d),[q(f,0,255),q(t,0,255),q(n,0,255),1]},k=function(e){return e>.206893034?e*e*e:(e-4/29)/7.787037},T=function(e){return Math.round(255*(.00304>=e?12.92*e:1.055*Math.pow(e,1/2.4)-.055))},j=function(){var e,r,n,t;return t=S(arguments),n=t[0],e=t[1],r=t[2],r=r*Math.PI/180,[n,Math.cos(r)*e,Math.sin(r)*e]},M=function(e,r,n){var t,f,o,a,i,c,u;return c=j(e,r,n),t=c[0],f=c[1],o=c[2],u=_(t,f,o),i=u[0],a=u[1],o=u[2],[q(i,0,255),q(a,0,255),q(o,0,255)]},C=function(e,r,n){var t;return t=S(arguments),e=t[0],r=t[1],n=t[2],e=N(e),r=N(r),n=N(n),.2126*e+.7152*r+.0722*n},N=function(e){return e/=255,.03928>=e?e/12.92:Math.pow((e+.055)/1.055,2.4)},U=function(){var e,r,n,t,f,o;return o=S(arguments),n=o[0],r=o[1],e=o[2],f=n<<16|r<<8|e,t="000000"+f.toString(16),"#"+t.substr(t.length-6)},A=function(){var e,r,n,t,f,o,a,i,c;return c=S(arguments),a=c[0],n=c[1],r=c[2],e=2*Math.PI,a/=255,n/=255,r/=255,o=Math.min(a,n,r),f=(a+n+r)/3,i=1-o/f,0===i?t=0:(t=(a-n+(a-r))/2,t/=Math.sqrt((a-n)*(a-n)+(a-r)*(n-r)),t=Math.acos(t),r>n&&(t=e-t),t/=e),[360*t,i,f]},P=function(e,r,n){var t,f,o,a,i,c;return void 0!==e&&e.length>=3&&(c=e,e=c[0],r=c[1],n=c[2]),e/=255,r/=255,n/=255,a=Math.min(e,r,n),o=Math.max(e,r,n),f=(o+a)/2,o===a?(i=0,t=Number.NaN):i=.5>f?(o-a)/(o+a):(o-a)/(2-o-a),e===o?t=(r-n)/(o-a):r===o?t=2+(n-e)/(o-a):n===o&&(t=4+(e-r)/(o-a)),t*=60,0>t&&(t+=360),[t,i,f]},z=function(){var e,r,n,t,f,o,a,i,c,u;return u=S(arguments),a=u[0],n=u[1],e=u[2],o=Math.min(a,n,e),f=Math.max(a,n,e),r=f-o,c=f/255,0===f?(t=Number.NaN,i=0):(i=r/f,a===f&&(t=(n-e)/r),n===f&&(t=2+(e-a)/r),e===f&&(t=4+(a-n)/r),t*=60,0>t&&(t+=360)),[t,i,c]},G=function(){var e,r,n,t,f,o,a;return a=S(arguments),n=a[0],r=a[1],e=a[2],n=B(n),r=B(r),e=B(e),t=O((.4124564*n+.3575761*r+.1804375*e)/i),f=O((.2126729*n+.7151522*r+.072175*e)/c),o=O((.0193339*n+.119192*r+.9503041*e)/u),[116*f-16,500*(t-f),200*(f-o)]},B=function(e){return(e/=255)<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4)},O=function(e){return e>.008856?Math.pow(e,1/3):7.787037*e+4/29},E=function(){var e,r,n,t,f,o,a;return o=S(arguments),f=o[0],n=o[1],r=o[2],a=G(f,n,r),t=a[0],e=a[1],r=a[2],x(t,e,r)},l.scale=function(e,r){var n,t,f,o,a,i,c,u,d,s,b,h,g,p,m,y,v,w,x,_,k;return y="rgb",v=l("#ccc"),k=0,g=!1,h=[0,1],s=[],x=!1,_=[],m=0,p=1,b=!1,w=0,d={},i=function(e,r){var n,t,f,o,i,c,u;if(null==e&&(e=["#ddd","#222"]),null!=e&&"string"===R(e)&&null!=(null!=(i=l.brewer)?i[e]:void 0)&&(e=l.brewer[e]),"array"===R(e)){for(e=e.slice(0),n=f=0,c=e.length-1;c>=0?c>=f:f>=c;n=c>=0?++f:--f)t=e[n],"string"===R(t)&&(e[n]=l(t));if(null!=r)_=r;else for(_=[],n=o=0,u=e.length-1;u>=0?u>=o:o>=u;n=u>=0?++o:--o)_.push(n/(e.length-1))}return a(),s=e},c=function(e){return null==e&&(e=[]),h=e,m=e[0],p=e[e.length-1],a(),w=2===e.length?0:e.length-1},f=function(e){var r,n;if(null!=h){for(n=h.length-1,r=0;n>r&&e>=h[r];)r++;return r-1}return 0},u=function(e){return e},n=function(e){var r,n,t,o,a;return a=e,h.length>2&&(o=h.length-1,r=f(e),t=h[0]+(h[1]-h[0])*(0+.5*k),n=h[o-1]+(h[o]-h[o-1])*(1-.5*k),a=m+(h[r]+.5*(h[r+1]-h[r])-t)/(n-t)*(p-m)),a},o=function(e,r){var n,t,o,a,i,c,b,g,x;if(null==r&&(r=!1),isNaN(e))return v;if(r?b=e:h.length>2?(n=f(e),b=n/(w-1)):(b=o=m!==p?(e-m)/(p-m):0,b=o=(e-m)/(p-m),b=Math.min(1,Math.max(0,b))),r||(b=u(b)),i=Math.floor(1e4*b),d[i])t=d[i];else{if("array"===R(s))for(a=g=0,x=_.length-1;x>=0?x>=g:g>=x;a=x>=0?++g:--g){if(c=_[a],c>=b){t=s[a];break}if(b>=c&&a===_.length-1){t=s[a];break}if(b>c&&b<_[a+1]){b=(b-c)/(_[a+1]-c),t=l.interpolate(s[a],s[a+1],b,y);break}}else"function"===R(s)&&(t=s(b));d[i]=t}return t},a=function(){return d={}},i(e,r),t=function(e){var r;return r=o(e),x&&r[x]?r[x]():r},t.domain=function(e,r,n,f){var o;return null==n&&(n="e"),arguments.length?(null!=r&&(o=l.analyze(e,f),e=0===r?[o.min,o.max]:l.limits(o,n,r)),c(e),t):h},t.mode=function(e){return arguments.length?(y=e,a(),t):y},t.range=function(e,r){return i(e,r),t},t.out=function(e){return x=e,t},t.spread=function(e){return arguments.length?(k=e,t):k},t.correctLightness=function(e){return arguments.length?(b=e,a(),u=b?function(e){var r,n,t,f,a,i,c,u,d;for(r=o(0,!0).lab()[0],n=o(1,!0).lab()[0],c=r>n,t=o(e,!0).lab()[0],a=r+(n-r)*e,f=t-a,u=0,d=1,i=20;Math.abs(f)>.01&&i-->0;)!function(){return c&&(f*=-1),0>f?(u=e,e+=.5*(d-e)):(d=e,e+=.5*(u-e)),t=o(e,!0).lab()[0],f=t-a}();return e}:function(e){return e},t):b},t.colors=function(r){var n,f,o,a,i,c;if(null==r&&(r="hex"),e=[],f=[],h.length>2)for(n=o=1,c=h.length;c>=1?c>o:o>c;n=c>=1?++o:--o)f.push(.5*(h[n-1]+h[n]));else f=h;for(a=0,i=f.length;i>a;a++)n=f[a],e.push(t(n)[r]());return e},t},null==(Y=l.scales)&&(l.scales={}),l.scales.cool=function(){return l.scale([l.hsl(180,1,.9),l.hsl(250,.7,.4)])},l.scales.hot=function(){return l.scale(["#000","#f00","#ff0","#fff"],[0,.25,.75,1]).mode("rgb")},l.analyze=function(e,r,n){var t,f,o,a,i,c,u;if(o={min:Number.MAX_VALUE,max:-1*Number.MAX_VALUE,sum:0,values:[],count:0},null==n&&(n=function(){return!0}),t=function(e){null==e||isNaN(e)||(o.values.push(e),o.sum+=e,e<o.min&&(o.min=e),e>o.max&&(o.max=e),o.count+=1)},i=function(e,f){return n(e,f)?null!=r&&"function"===R(r)?t(r(e)):null!=r&&"string"===R(r)||"number"===R(r)?t(e[r]):t(e):void 0},"array"===R(e))for(c=0,u=e.length;u>c;c++)a=e[c],i(a);else for(f in e)a=e[f],i(a,f);return o.domain=[o.min,o.max],o.limits=function(e,r){return l.limits(o,e,r)},o},l.limits=function(e,r,n){var t,f,o,a,i,c,u,d,s,b,h,g,p,m,y,v,w,x,_,k,j,M,q,C,N,U,A,P,z,G,E,B,I,S,O,T,Y,L,F,D,V,X,W,$,Z,H,J,K,Q,er,rr,nr,tr,fr,or,ar;if(null==r&&(r="equal"),null==n&&(n=7),"array"===R(e)&&(e=l.analyze(e)),p=e.min,h=e.max,q=e.sum,U=e.values.sort(function(e,r){return e-r}),b=[],"c"===r.substr(0,1)&&(b.push(p),b.push(h)),"e"===r.substr(0,1)){for(b.push(p),u=A=1,Y=n-1;Y>=1?Y>=A:A>=Y;u=Y>=1?++A:--A)b.push(p+u/n*(h-p));b.push(h)}else if("l"===r.substr(0,1)){if(0>=p)throw"Logarithmic scales are only possible for values > 0";for(m=Math.LOG10E*Math.log(p),g=Math.LOG10E*Math.log(h),b.push(p),u=P=1,$=n-1;$>=1?$>=P:P>=$;u=$>=1?++P:--P)b.push(Math.pow(10,m+u/n*(g-m)));b.push(h)}else if("q"===r.substr(0,1)){for(b.push(p),u=z=1,Z=n-1;Z>=1?Z>=z:z>=Z;u=Z>=1?++z:--z)_=U.length*u/n,k=Math.floor(_),k===_?b.push(U[k]):(j=_-k,b.push(U[k]*j+U[k+1]*(1-j)));b.push(h)}else if("k"===r.substr(0,1)){for(v=U.length,t=new Array(v),i=new Array(n),M=!0,w=0,o=null,o=[],o.push(p),u=G=1,H=n-1;H>=1?H>=G:G>=H;u=H>=1?++G:--G)o.push(p+u/n*(h-p));for(o.push(h);M;){for(d=E=0,J=n-1;J>=0?J>=E:E>=J;d=J>=0?++E:--E)i[d]=0;for(u=B=0,K=v-1;K>=0?K>=B:B>=K;u=K>=0?++B:--B){for(N=U[u],y=Number.MAX_VALUE,d=I=0,Q=n-1;Q>=0?Q>=I:I>=Q;d=Q>=0?++I:--I)c=Math.abs(o[d]-N),y>c&&(y=c,f=d);i[f]++,t[u]=f}for(x=new Array(n),d=S=0,er=n-1;er>=0?er>=S:S>=er;d=er>=0?++S:--S)x[d]=null;for(u=O=0,rr=v-1;rr>=0?rr>=O:O>=rr;u=rr>=0?++O:--O)a=t[u],null===x[a]?x[a]=U[u]:x[a]+=U[u];for(d=T=0,L=n-1;L>=0?L>=T:T>=L;d=L>=0?++T:--T)x[d]*=1/i[d];for(M=!1,d=nr=0,F=n-1;F>=0?F>=nr:nr>=F;d=F>=0?++nr:--nr)if(x[d]!==o[u]){M=!0;break}o=x,w++,w>200&&(M=!1)}for(s={},d=tr=0,D=n-1;D>=0?D>=tr:tr>=D;d=D>=0?++tr:--tr)s[d]=[];for(u=fr=0,V=v-1;V>=0?V>=fr:fr>=V;u=V>=0?++fr:--fr)a=t[u],s[a].push(U[u]);for(C=[],d=or=0,X=n-1;X>=0?X>=or:or>=X;d=X>=0?++or:--or)C.push(s[d][0]),C.push(s[d][s[d].length-1]);for(C=C.sort(function(e,r){return e-r}),b.push(C[0]),u=ar=1,W=C.length-1;W>=ar;u=ar+=2)isNaN(C[u])||b.push(C[u])}return b},l.brewer=s={OrRd:["#fff7ec","#fee8c8","#fdd49e","#fdbb84","#fc8d59","#ef6548","#d7301f","#b30000","#7f0000"],PuBu:["#fff7fb","#ece7f2","#d0d1e6","#a6bddb","#74a9cf","#3690c0","#0570b0","#045a8d","#023858"],BuPu:["#f7fcfd","#e0ecf4","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#810f7c","#4d004b"],Oranges:["#fff5eb","#fee6ce","#fdd0a2","#fdae6b","#fd8d3c","#f16913","#d94801","#a63603","#7f2704"],BuGn:["#f7fcfd","#e5f5f9","#ccece6","#99d8c9","#66c2a4","#41ae76","#238b45","#006d2c","#00441b"],YlOrBr:["#ffffe5","#fff7bc","#fee391","#fec44f","#fe9929","#ec7014","#cc4c02","#993404","#662506"],YlGn:["#ffffe5","#f7fcb9","#d9f0a3","#addd8e","#78c679","#41ab5d","#238443","#006837","#004529"],Reds:["#fff5f0","#fee0d2","#fcbba1","#fc9272","#fb6a4a","#ef3b2c","#cb181d","#a50f15","#67000d"],RdPu:["#fff7f3","#fde0dd","#fcc5c0","#fa9fb5","#f768a1","#dd3497","#ae017e","#7a0177","#49006a"],Greens:["#f7fcf5","#e5f5e0","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#006d2c","#00441b"],YlGnBu:["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"],Purples:["#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8","#807dba","#6a51a3","#54278f","#3f007d"],GnBu:["#f7fcf0","#e0f3db","#ccebc5","#a8ddb5","#7bccc4","#4eb3d3","#2b8cbe","#0868ac","#084081"],Greys:["#ffffff","#f0f0f0","#d9d9d9","#bdbdbd","#969696","#737373","#525252","#252525","#000000"],YlOrRd:["#ffffcc","#ffeda0","#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"],PuRd:["#f7f4f9","#e7e1ef","#d4b9da","#c994c7","#df65b0","#e7298a","#ce1256","#980043","#67001f"],Blues:["#f7fbff","#deebf7","#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#08519c","#08306b"],PuBuGn:["#fff7fb","#ece2f0","#d0d1e6","#a6bddb","#67a9cf","#3690c0","#02818a","#016c59","#014636"],Spectral:["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"],RdYlGn:["#a50026","#d73027","#f46d43","#fdae61","#fee08b","#ffffbf","#d9ef8b","#a6d96a","#66bd63","#1a9850","#006837"],RdBu:["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#f7f7f7","#d1e5f0","#92c5de","#4393c3","#2166ac","#053061"],PiYG:["#8e0152","#c51b7d","#de77ae","#f1b6da","#fde0ef","#f7f7f7","#e6f5d0","#b8e186","#7fbc41","#4d9221","#276419"],PRGn:["#40004b","#762a83","#9970ab","#c2a5cf","#e7d4e8","#f7f7f7","#d9f0d3","#a6dba0","#5aae61","#1b7837","#00441b"],RdYlBu:["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"],BrBG:["#543005","#8c510a","#bf812d","#dfc27d","#f6e8c3","#f5f5f5","#c7eae5","#80cdc1","#35978f","#01665e","#003c30"],RdGy:["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#ffffff","#e0e0e0","#bababa","#878787","#4d4d4d","#1a1a1a"],PuOr:["#7f3b08","#b35806","#e08214","#fdb863","#fee0b6","#f7f7f7","#d8daeb","#b2abd2","#8073ac","#542788","#2d004b"],Set2:["#66c2a5","#fc8d62","#8da0cb","#e78ac3","#a6d854","#ffd92f","#e5c494","#b3b3b3"],Accent:["#7fc97f","#beaed4","#fdc086","#ffff99","#386cb0","#f0027f","#bf5b17","#666666"],Set1:["#e41a1c","#377eb8","#4daf4a","#984ea3","#ff7f00","#ffff33","#a65628","#f781bf","#999999"],Set3:["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd","#ccebc5","#ffed6f"],Dark2:["#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#e6ab02","#a6761d","#666666"],Paired:["#a6cee3","#1f78b4","#b2df8a","#33a02c","#fb9a99","#e31a1c","#fdbf6f","#ff7f00","#cab2d6","#6a3d9a","#ffff99","#b15928"],Pastel2:["#b3e2cd","#fdcdac","#cbd5e8","#f4cae4","#e6f5c9","#fff2ae","#f1e2cc","#cccccc"],Pastel1:["#fbb4ae","#b3cde3","#ccebc5","#decbe4","#fed9a6","#ffffcc","#e5d8bd","#fddaec","#f2f2f2"]},l.colors=h={indigo:"#4b0082",gold:"#ffd700",hotpink:"#ff69b4",firebrick:"#b22222",indianred:"#cd5c5c",yellow:"#ffff00",mistyrose:"#ffe4e1",darkolivegreen:"#556b2f",olive:"#808000",darkseagreen:"#8fbc8f",pink:"#ffc0cb",tomato:"#ff6347",lightcoral:"#f08080",orangered:"#ff4500",navajowhite:"#ffdead",lime:"#00ff00",palegreen:"#98fb98",darkslategrey:"#2f4f4f",greenyellow:"#adff2f",burlywood:"#deb887",seashell:"#fff5ee",mediumspringgreen:"#00fa9a",fuchsia:"#ff00ff",papayawhip:"#ffefd5",blanchedalmond:"#ffebcd",chartreuse:"#7fff00",dimgray:"#696969",black:"#000000",peachpuff:"#ffdab9",springgreen:"#00ff7f",aquamarine:"#7fffd4",white:"#ffffff",orange:"#ffa500",lightsalmon:"#ffa07a",darkslategray:"#2f4f4f",brown:"#a52a2a",ivory:"#fffff0",dodgerblue:"#1e90ff",peru:"#cd853f",lawngreen:"#7cfc00",chocolate:"#d2691e",crimson:"#dc143c",forestgreen:"#228b22",darkgrey:"#a9a9a9",lightseagreen:"#20b2aa",cyan:"#00ffff",mintcream:"#f5fffa",silver:"#c0c0c0",antiquewhite:"#faebd7",mediumorchid:"#ba55d3",skyblue:"#87ceeb",gray:"#808080",darkturquoise:"#00ced1",goldenrod:"#daa520",darkgreen:"#006400",floralwhite:"#fffaf0",darkviolet:"#9400d3",darkgray:"#a9a9a9",moccasin:"#ffe4b5",saddlebrown:"#8b4513",grey:"#808080",darkslateblue:"#483d8b",lightskyblue:"#87cefa",lightpink:"#ffb6c1",mediumvioletred:"#c71585",slategrey:"#708090",red:"#ff0000",deeppink:"#ff1493",limegreen:"#32cd32",darkmagenta:"#8b008b",palegoldenrod:"#eee8aa",plum:"#dda0dd",turquoise:"#40e0d0",lightgrey:"#d3d3d3",lightgoldenrodyellow:"#fafad2",darkgoldenrod:"#b8860b",lavender:"#e6e6fa",maroon:"#800000",yellowgreen:"#9acd32",sandybrown:"#f4a460",thistle:"#d8bfd8",violet:"#ee82ee",navy:"#000080",magenta:"#ff00ff",dimgrey:"#696969",tan:"#d2b48c",rosybrown:"#bc8f8f",olivedrab:"#6b8e23",blue:"#0000ff",lightblue:"#add8e6",ghostwhite:"#f8f8ff",honeydew:"#f0fff0",cornflowerblue:"#6495ed",slateblue:"#6a5acd",linen:"#faf0e6",darkblue:"#00008b",powderblue:"#b0e0e6",seagreen:"#2e8b57",darkkhaki:"#bdb76b",snow:"#fffafa",sienna:"#a0522d",mediumblue:"#0000cd",royalblue:"#4169e1",lightcyan:"#e0ffff",green:"#008000",mediumpurple:"#9370db",midnightblue:"#191970",cornsilk:"#fff8dc",paleturquoise:"#afeeee",bisque:"#ffe4c4",slategray:"#708090",darkcyan:"#008b8b",khaki:"#f0e68c",wheat:"#f5deb3",teal:"#008080",darkorchid:"#9932cc",deepskyblue:"#00bfff",salmon:"#fa8072",darkred:"#8b0000",steelblue:"#4682b4",palevioletred:"#db7093",lightslategray:"#778899",aliceblue:"#f0f8ff",lightslategrey:"#778899",lightgreen:"#90ee90",orchid:"#da70d6",gainsboro:"#dcdcdc",mediumseagreen:"#3cb371",lightgray:"#d3d3d3",mediumturquoise:"#48d1cc",lemonchiffon:"#fffacd",cadetblue:"#5f9ea0",lightyellow:"#ffffe0",lavenderblush:"#fff0f5",coral:"#ff7f50",purple:"#800080",aqua:"#00ffff",whitesmoke:"#f5f5f5",mediumslateblue:"#7b68ee",darkorange:"#ff8c00",mediumaquamarine:"#66cdaa",darksalmon:"#e9967a",beige:"#f5f5dc",blueviolet:"#8a2be2",azure:"#f0ffff",lightsteelblue:"#b0c4de",oldlace:"#fdf5e6"},R=function(){var e,r,n,t,f;for(e={},f="Boolean Number String Function Array Date RegExp Undefined Null".split(" "),n=0,t=f.length;t>n;n++)r=f[n],e["[object "+r+"]"]=r.toLowerCase();return function(r){var n;return n=Object.prototype.toString.call(r),e[n]||"object"}}(),q=function(e,r,n){return null==r&&(r=0),null==n&&(n=1),r>e&&(e=r),e>n&&(e=n),e},S=function(e){return e.length>=3?e:e[0]},a=2*Math.PI,o=Math.PI/3,g=Math.cos,d=function(e){var r,n,t,f,o,a,i,c,u,s,b;return e=function(){var r,n,t;for(t=[],r=0,n=e.length;n>r;r++)f=e[r],t.push(l(f));return t}(),2===e.length?(u=function(){var r,n,t;for(t=[],r=0,n=e.length;n>r;r++)f=e[r],t.push(f.lab());return t}(),o=u[0],a=u[1],r=function(e){var r,n;return n=function(){var n,t;for(t=[],r=n=0;2>=n;r=++n)t.push(o[r]+e*(a[r]-o[r]));return t}(),l.lab.apply(l,n)}):3===e.length?(s=function(){var r,n,t;
for(t=[],r=0,n=e.length;n>r;r++)f=e[r],t.push(f.lab());return t}(),o=s[0],a=s[1],i=s[2],r=function(e){var r,n;return n=function(){var n,t;for(t=[],r=n=0;2>=n;r=++n)t.push((1-e)*(1-e)*o[r]+2*(1-e)*e*a[r]+e*e*i[r]);return t}(),l.lab.apply(l,n)}):4===e.length?(b=function(){var r,n,t;for(t=[],r=0,n=e.length;n>r;r++)f=e[r],t.push(f.lab());return t}(),o=b[0],a=b[1],i=b[2],c=b[3],r=function(e){var r,n;return n=function(){var n,t;for(t=[],r=n=0;2>=n;r=++n)t.push((1-e)*(1-e)*(1-e)*o[r]+3*(1-e)*(1-e)*e*a[r]+3*(1-e)*e*e*i[r]+e*e*e*c[r]);return t}(),l.lab.apply(l,n)}):5===e.length&&(n=d(e.slice(0,3)),t=d(e.slice(2,5)),r=function(e){return.5>e?n(2*e):t(2*(e-.5))}),r},l.interpolate.bezier=d}).call(this)},{}],"/Users/qrohlf/Code/trianglify/node_modules/delaunay-fast/delaunay.js":[function(e,r){var n;!function(){"use strict";function e(e){var r,n,t,f,o,a,i=Number.POSITIVE_INFINITY,c=Number.POSITIVE_INFINITY,u=Number.NEGATIVE_INFINITY,d=Number.NEGATIVE_INFINITY;for(r=e.length;r--;)e[r][0]<i&&(i=e[r][0]),e[r][0]>u&&(u=e[r][0]),e[r][1]<c&&(c=e[r][1]),e[r][1]>d&&(d=e[r][1]);return n=u-i,t=d-c,f=Math.max(n,t),o=i+.5*n,a=c+.5*t,[[o-20*f,a-f],[o,a+20*f],[o+20*f,a-f]]}function t(e,r,n,t){var f,a,i,c,u,d,s,l,b,h,g=e[r][0],p=e[r][1],m=e[n][0],y=e[n][1],v=e[t][0],w=e[t][1],x=Math.abs(p-y),_=Math.abs(y-w);if(o>x&&o>_)throw new Error("Eek! Coincident points!");return o>x?(c=-((v-m)/(w-y)),d=(m+v)/2,l=(y+w)/2,f=(m+g)/2,a=c*(f-d)+l):o>_?(i=-((m-g)/(y-p)),u=(g+m)/2,s=(p+y)/2,f=(v+m)/2,a=i*(f-u)+s):(i=-((m-g)/(y-p)),c=-((v-m)/(w-y)),u=(g+m)/2,d=(m+v)/2,s=(p+y)/2,l=(y+w)/2,f=(i*u-c*d+l-s)/(i-c),a=x>_?i*(f-u)+s:c*(f-d)+l),b=m-f,h=y-a,{i:r,j:n,k:t,x:f,y:a,r:b*b+h*h}}function f(e){var r,n,t,f,o,a;for(n=e.length;n;)for(f=e[--n],t=e[--n],r=n;r;)if(a=e[--r],o=e[--r],t===o&&f===a||t===a&&f===o){e.splice(n,2),e.splice(r,2);break}}var o=1/1048576;n={triangulate:function(r,n){var a,i,c,u,d,s,l,b,h,g,p,m,y=r.length;if(3>y)return[];if(r=r.slice(0),n)for(a=y;a--;)r[a]=r[a][n];for(c=new Array(y),a=y;a--;)c[a]=a;for(c.sort(function(e,n){return r[n][0]-r[e][0]}),u=e(r),r.push(u[0],u[1],u[2]),d=[t(r,y+0,y+1,y+2)],s=[],l=[],a=c.length;a--;l.length=0){for(m=c[a],i=d.length;i--;)b=r[m][0]-d[i].x,b>0&&b*b>d[i].r?(s.push(d[i]),d.splice(i,1)):(h=r[m][1]-d[i].y,b*b+h*h-d[i].r>o||(l.push(d[i].i,d[i].j,d[i].j,d[i].k,d[i].k,d[i].i),d.splice(i,1)));for(f(l),i=l.length;i;)p=l[--i],g=l[--i],d.push(t(r,g,p,m))}for(a=d.length;a--;)s.push(d[a]);for(d.length=0,a=s.length;a--;)s[a].i<y&&s[a].j<y&&s[a].k<y&&d.push(s[a].i,s[a].j,s[a].k);return d},contains:function(e,r){if(r[0]<e[0][0]&&r[0]<e[1][0]&&r[0]<e[2][0]||r[0]>e[0][0]&&r[0]>e[1][0]&&r[0]>e[2][0]||r[1]<e[0][1]&&r[1]<e[1][1]&&r[1]<e[2][1]||r[1]>e[0][1]&&r[1]>e[1][1]&&r[1]>e[2][1])return null;var n=e[1][0]-e[0][0],t=e[2][0]-e[0][0],f=e[1][1]-e[0][1],o=e[2][1]-e[0][1],a=n*o-t*f;if(0===a)return null;var i=(o*(r[0]-e[0][0])-t*(r[1]-e[0][1]))/a,c=(n*(r[1]-e[0][1])-f*(r[0]-e[0][0]))/a;return 0>i||0>c||i+c>1?null:[i,c]}},"undefined"!=typeof r&&(r.exports=n)}()},{}],"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/index.js":[function(e,r){var n=e("./lib/alea"),t=e("./lib/xor128"),f=e("./lib/xorwow"),o=e("./lib/xorshift7"),a=e("./lib/xor4096"),i=e("./lib/tychei"),c=e("./seedrandom");c.alea=n,c.xor128=t,c.xorwow=f,c.xorshift7=o,c.xor4096=a,c.tychei=i,r.exports=c},{"./lib/alea":"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/alea.js","./lib/tychei":"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/tychei.js","./lib/xor128":"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/xor128.js","./lib/xor4096":"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/xor4096.js","./lib/xorshift7":"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/xorshift7.js","./lib/xorwow":"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/xorwow.js","./seedrandom":"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/seedrandom.js"}],"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/alea.js":[function(r,n){!function(e,r,n){function t(e){var r=this,n=a();r.next=function(){var e=2091639*r.s0+2.3283064365386963e-10*r.c;return r.s0=r.s1,r.s1=r.s2,r.s2=e-(r.c=0|e)},r.c=1,r.s0=n(" "),r.s1=n(" "),r.s2=n(" "),r.s0-=n(e),r.s0<0&&(r.s0+=1),r.s1-=n(e),r.s1<0&&(r.s1+=1),r.s2-=n(e),r.s2<0&&(r.s2+=1),n=null}function f(e,r){return r.c=e.c,r.s0=e.s0,r.s1=e.s1,r.s2=e.s2,r}function o(e,r){var n=new t(e),o=r&&r.state,a=n.next;return a.int32=function(){return 4294967296*n.next()|0},a.double=function(){return a()+1.1102230246251565e-16*(2097152*a()|0)},a.quick=a,o&&("object"==typeof o&&f(o,n),a.state=function(){return f(n,{})}),a}function a(){var e=4022871197,r=function(r){r=r.toString();for(var n=0;n<r.length;n++){e+=r.charCodeAt(n);var t=.02519603282416938*e;e=t>>>0,t-=e,t*=e,e=t>>>0,t-=e,e+=4294967296*t}return 2.3283064365386963e-10*(e>>>0)};return r}r&&r.exports?r.exports=o:n&&n.amd?n(function(){return o}):this.alea=o}(this,"object"==typeof n&&n,"function"==typeof e&&e)},{}],"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/tychei.js":[function(r,n){!function(e,r,n){function t(e){var r=this,n="";r.next=function(){var e=r.b,n=r.c,t=r.d,f=r.a;return e=e<<25^e>>>7^n,n=n-t|0,t=t<<24^t>>>8^f,f=f-e|0,r.b=e=e<<20^e>>>12^n,r.c=n=n-t|0,r.d=t<<16^n>>>16^f,r.a=f-e|0},r.a=0,r.b=0,r.c=-1640531527,r.d=1367130551,e===Math.floor(e)?(r.a=e/4294967296|0,r.b=0|e):n+=e;for(var t=0;t<n.length+20;t++)r.b^=0|n.charCodeAt(t),r.next()}function f(e,r){return r.a=e.a,r.b=e.b,r.c=e.c,r.d=e.d,r}function o(e,r){var n=new t(e),o=r&&r.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do var e=n.next()>>>11,r=(n.next()>>>0)/4294967296,t=(e+r)/(1<<21);while(0===t);return t},a.int32=n.next,a.quick=a,o&&("object"==typeof o&&f(o,n),a.state=function(){return f(n,{})}),a}r&&r.exports?r.exports=o:n&&n.amd?n(function(){return o}):this.tychei=o}(this,"object"==typeof n&&n,"function"==typeof e&&e)},{}],"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/xor128.js":[function(r,n){!function(e,r,n){function t(e){var r=this,n="";r.x=0,r.y=0,r.z=0,r.w=0,r.next=function(){var e=r.x^r.x<<11;return r.x=r.y,r.y=r.z,r.z=r.w,r.w^=r.w>>>19^e^e>>>8},e===(0|e)?r.x=e:n+=e;for(var t=0;t<n.length+64;t++)r.x^=0|n.charCodeAt(t),r.next()}function f(e,r){return r.x=e.x,r.y=e.y,r.z=e.z,r.w=e.w,r}function o(e,r){var n=new t(e),o=r&&r.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do var e=n.next()>>>11,r=(n.next()>>>0)/4294967296,t=(e+r)/(1<<21);while(0===t);return t},a.int32=n.next,a.quick=a,o&&("object"==typeof o&&f(o,n),a.state=function(){return f(n,{})}),a}r&&r.exports?r.exports=o:n&&n.amd?n(function(){return o}):this.xor128=o}(this,"object"==typeof n&&n,"function"==typeof e&&e)},{}],"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/xor4096.js":[function(r,n){!function(e,r,n){function t(e){function r(e,r){var n,t,f,o,a,i=[],c=128;for(r===(0|r)?(t=r,r=null):(r+="\x00",t=0,c=Math.max(c,r.length)),f=0,o=-32;c>o;++o)r&&(t^=r.charCodeAt((o+32)%r.length)),0===o&&(a=t),t^=t<<10,t^=t>>>15,t^=t<<4,t^=t>>>13,o>=0&&(a=a+1640531527|0,n=i[127&o]^=t+a,f=0==n?f+1:0);for(f>=128&&(i[127&(r&&r.length||0)]=-1),f=127,o=512;o>0;--o)t=i[f+34&127],n=i[f=f+1&127],t^=t<<13,n^=n<<17,t^=t>>>15,n^=n>>>12,i[f]=t^n;e.w=a,e.X=i,e.i=f}var n=this;n.next=function(){var e,r,t=n.w,f=n.X,o=n.i;return n.w=t=t+1640531527|0,r=f[o+34&127],e=f[o=o+1&127],r^=r<<13,e^=e<<17,r^=r>>>15,e^=e>>>12,r=f[o]=r^e,n.i=o,r+(t^t>>>16)|0},r(n,e)}function f(e,r){return r.i=e.i,r.w=e.w,r.X=e.X.slice(),r}function o(e,r){null==e&&(e=+new Date);var n=new t(e),o=r&&r.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do var e=n.next()>>>11,r=(n.next()>>>0)/4294967296,t=(e+r)/(1<<21);while(0===t);return t},a.int32=n.next,a.quick=a,o&&(o.X&&f(o,n),a.state=function(){return f(n,{})}),a}r&&r.exports?r.exports=o:n&&n.amd?n(function(){return o}):this.xor4096=o}(this,"object"==typeof n&&n,"function"==typeof e&&e)},{}],"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/xorshift7.js":[function(r,n){!function(e,r,n){function t(e){function r(e,r){var n,t,f=[];if(r===(0|r))t=f[0]=r;else for(r=""+r,n=0;n<r.length;++n)f[7&n]=f[7&n]<<15^r.charCodeAt(n)+f[n+1&7]<<13;for(;f.length<8;)f.push(0);for(n=0;8>n&&0===f[n];++n);for(t=8==n?f[7]=-1:f[n],e.x=f,e.i=0,n=256;n>0;--n)e.next()}var n=this;n.next=function(){var e,r,t=n.x,f=n.i;return e=t[f],e^=e>>>7,r=e^e<<24,e=t[f+1&7],r^=e^e>>>10,e=t[f+3&7],r^=e^e>>>3,e=t[f+4&7],r^=e^e<<7,e=t[f+7&7],e^=e<<13,r^=e^e<<9,t[f]=r,n.i=f+1&7,r},r(n,e)}function f(e,r){return r.x=e.x.slice(),r.i=e.i,r}function o(e,r){null==e&&(e=+new Date);var n=new t(e),o=r&&r.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do var e=n.next()>>>11,r=(n.next()>>>0)/4294967296,t=(e+r)/(1<<21);while(0===t);return t},a.int32=n.next,a.quick=a,o&&(o.x&&f(o,n),a.state=function(){return f(n,{})}),a}r&&r.exports?r.exports=o:n&&n.amd?n(function(){return o}):this.xorshift7=o}(this,"object"==typeof n&&n,"function"==typeof e&&e)},{}],"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/lib/xorwow.js":[function(r,n){!function(e,r,n){function t(e){var r=this,n="";r.next=function(){var e=r.x^r.x>>>2;return r.x=r.y,r.y=r.z,r.z=r.w,r.w=r.v,(r.d=r.d+362437|0)+(r.v=r.v^r.v<<4^(e^e<<1))|0},r.x=0,r.y=0,r.z=0,r.w=0,r.v=0,e===(0|e)?r.x=e:n+=e;for(var t=0;t<n.length+64;t++)r.x^=0|n.charCodeAt(t),t==n.length&&(r.d=r.x<<10^r.x>>>4),r.next()}function f(e,r){return r.x=e.x,r.y=e.y,r.z=e.z,r.w=e.w,r.v=e.v,r.d=e.d,r}function o(e,r){var n=new t(e),o=r&&r.state,a=function(){return(n.next()>>>0)/4294967296};return a.double=function(){do var e=n.next()>>>11,r=(n.next()>>>0)/4294967296,t=(e+r)/(1<<21);while(0===t);return t},a.int32=n.next,a.quick=a,o&&("object"==typeof o&&f(o,n),a.state=function(){return f(n,{})}),a}r&&r.exports?r.exports=o:n&&n.amd?n(function(){return o}):this.xorwow=o}(this,"object"==typeof n&&n,"function"==typeof e&&e)},{}],"/Users/qrohlf/Code/trianglify/node_modules/seedrandom/seedrandom.js":[function(r,n){!function(t,f){function o(e,r,n){var o=[];r=1==r?{entropy:!0}:r||{};var l=u(c(r.entropy?[e,s(t)]:null==e?d():e,3),o),b=new a(o),p=function(){for(var e=b.g(g),r=y,n=0;v>e;)e=(e+n)*h,r*=h,n=b.g(1);for(;e>=w;)e/=2,r/=2,n>>>=1;return(e+n)/r};return p.int32=function(){return 0|b.g(4)},p.quick=function(){return b.g(4)/4294967296},p.double=p,u(s(b.S),t),(r.pass||n||function(e,r,n,t){return t&&(t.S&&i(t,b),e.state=function(){return i(b,{})}),n?(f[m]=e,r):e})(p,l,"global"in r?r.global:this==f,r.state)}function a(e){var r,n=e.length,t=this,f=0,o=t.i=t.j=0,a=t.S=[];for(n||(e=[n++]);h>f;)a[f]=f++;for(f=0;h>f;f++)a[f]=a[o=x&o+e[f%n]+(r=a[f])],a[o]=r;(t.g=function(e){for(var r,n=0,f=t.i,o=t.j,a=t.S;e--;)r=a[f=x&f+1],n=n*h+a[x&(a[f]=a[o=x&o+r])+(a[o]=r)];return t.i=f,t.j=o,n})(h)}function i(e,r){return r.i=e.i,r.j=e.j,r.S=e.S.slice(),r}function c(e,r){var n,t=[],f=typeof e;if(r&&"object"==f)for(n in e)try{t.push(c(e[n],r-1))}catch(o){}return t.length?t:"string"==f?e:e+"\x00"}function u(e,r){for(var n,t=e+"",f=0;f<t.length;)r[x&f]=x&(n^=19*r[x&f])+t.charCodeAt(f++);return s(r)}function d(){try{if(l)return s(l.randomBytes(h));var e=new Uint8Array(h);return(b.crypto||b.msCrypto).getRandomValues(e),s(e)}catch(r){var n=b.navigator,f=n&&n.plugins;return[+new Date,b,f,b.screen,s(t)]}}function s(e){return String.fromCharCode.apply(0,e)}var l,b=this,h=256,g=6,p=52,m="random",y=f.pow(h,g),v=f.pow(2,p),w=2*v,x=h-1;if(f["seed"+m]=o,u(f.random(),t),"object"==typeof n&&n.exports){n.exports=o;try{l=r("crypto")}catch(_){}}else"function"==typeof e&&e.amd&&e(function(){return o})}([],Math)},{crypto:!1}]},{},["./lib/trianglify.js"])("./lib/trianglify.js")});
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
		cell_size: 70,
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