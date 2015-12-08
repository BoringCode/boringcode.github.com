---
layout: post
title:  "Designing the Weather"
date:   2014-09-01 12:00:00
---
This summer I built a [weather app](http://clearskiesapp.com). You may be wondering, does the world really need another weather app? Of course! Most weather apps suffer from information density or information drought. They tend to be heavily designed and make finding information difficult. I wanted something different. I wanted a weather app that was well designed, offered just the right amount of information, and that I could use anywhere. I built [Clear Skies](http://clearskiesapp.com) to do just that.

##Development

When I began the project I had to decide what the app should do. I created a big list of everything that I wanted to know about the weather and why I wanted to know it. The temperature was the obvious first pick. But then I had to decide whether I really needed to know the speed and direction of the wind (I included that because I like to fly kites). One decision I made was to represent a lot of weather data through a wide range of icons. I decided to use [Climacons](http://adamwhitcroft.com/climacons/) because they are well designed and there are quite a few of them. It is hard to get information density right. In fact, for a lot of people my app might not have enough information. But I think I struck the right balance.

[Forecast.io](http://forecast.io) has a really well designed API which returns an incredible amount of data. Because of the minutely and hourly data that it provides, I was able to design a "it will rain in x minutes" feature which feels really magical at first. I was also able to easily support Farenheight and Celsius.

Clear Skies was a chance for me to learn new development techniques. I used [Angular.js](https://angularjs.org/) so I could develop the app completely client side. The ability to keep a data set and the modal in sync is incredible and I love how Angular.js makes interacting with RESTful API's easy. I created my build system with [Grunt](http://gruntjs.com). Grunt is a task runner that allows me to minify my files, create an appcache manifest, and push to production with one command (among other things). It also made developing locally easy because I could run a livereload server.

I wanted to be able to use the app anywhere, so developing responsively was a must. A flexible grid is used to layout screen elements and em's are used to size interface elements. Using em's makes the size of all elements based upon the font size set on the body. Whenever the user is on a small-screen device I just make the base font size smaller and the entire interface adapts to that one change. Beyond just responsive design, I added meta tags and icons to allow the web app to be installed on the homescreen of the user's device.

##Design

![Clear Skies app interface](/assets/blog/clearskies.png)

The colors of Clear Skies are a little unusual for a weather app. Many weather apps are dominated by blue. This makes sense, the weather can be rather blue. But I wanted Clear Skies to be optimistic, upbeat, and different. So I chose a orange-red and a light blue for my color scheme. The orange-red reminds me of a sunset while the light blue of a clear sky. I took the same approach when designing the [icon](http://clearskiesapp.com/icon/favicon-96x96.png). I wanted an icon that represented what the app was about. An umbrella or rain drop would have been stereotypical and boring. So I designed an icon that represents a clear sky over a hill. It isn't a very "iconic" icon, but it works well for the application that I'm using it in.

I hope you enjoy using Clear Skies as much as I enjoyed making it. Please [let me know what you think](/contact/). I love answering questions and fixing bugs.