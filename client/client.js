//TEMPLATE ON-RENDERED FUNCTIONALITY
Template.viewTrack.onRendered(function () {
    this.autorun(function () {
        var retrievedData = Template.currentData();
        retrievedData.locations.pop();
        document.getElementById("charts").innerHTML = "";
        makeChart(retrievedData, "ElevVsTime");
        makeChart(retrievedData, "ElevVsDist");
    });
    //hard-coding this value, route name is not gallery but need to use something
    updateNav('gallery');
});

//using several of these template onrendered's to update navbar links
Template.gallery.onRendered(function () {
    updateNav(Router.current().route.getName());
});

Template.upload.onRendered(function () {
    updateNav(Router.current().route.getName());
});

Template.about.onRendered(function () {
    var trackObj = Tracks.findOne('04de18e99b95ee2153f258ceea5eaa02');
    trackObj.locations.pop();
    document.getElementById("charts").innerHTML = "";
    makeChart(trackObj, "ElevVsDist", 3000);

    updateNav(Router.current().route.getName());
});



//TEMPLATE HELPERS
Template.gallery.helpers({
    tracks: function () {
        return Tracks.find().fetch();
    }
});



//TEMPLATE EVENTS
Template.upload.events({
    'mousedown #uploadBtnHolder': function (event) {
        $('#uploadBtnUp').css('visibility', 'hidden');
    },
    'mouseup #uploadBtnHolder': function (event) {
        $('#uploadBtnUp').css('visibility', 'visible');
        $('#fileUpload').trigger('click');
        //        setTimeout(function () {
        //            $('#fileUpload').trigger('click').click();
        ////            console.log($('#fileUpload'));
        //        }, 0);
    },
    'change #fileUpload': function (event) {
        var fileInfo = event.currentTarget.files[0];
        var reader = new FileReader();

        reader.onload = function (event) {
            var fileContent = reader.result;

            Meteor.call('fileUpload', fileContent, function (err, result) {
                //if this content already in mongo, send the data to makeChart
                if (result.exists == true) {
                    var mongoData = result.jsonData;
                    // remove last loc, doesn't have "current distVal"
                    mongoData.locations.pop();
                    document.getElementById("charts").innerHTML = "";
                    makeChart(mongoData, "ElevVsTime");
                    makeChart(mongoData, "ElevVsDist");
                } else {
                    //if not in mongo, needs to be parsed
                    var hash = result.hash;
                    var xmlData = result.xmlData;
                    Meteor.call('parseAndOutput', xmlData, hash, function (err, result) {
                        // remove last loc, doesn't have "current distVal"
                        result.locations.pop();
                        document.getElementById("charts").innerHTML = "";
                        makeChart(result, "ElevVsTime");
                        makeChart(result, "ElevVsDist");
                    });
                }
            });

        };
        //this triggers the reader.onload step above
        //we don't really do anything with it
        reader.readAsText(fileInfo);
    }
});



//LOOSE FUNCTIONS

//Update borders on nav links
function updateNav(routeName) {
    $('.navLink').css('border', '0px');
    $('#nav_' + routeName).css('border-top', '1px solid black');
    $('#nav_' + routeName).css('border-bottom', '1px solid black');
}


//Render the line charts
function makeChart(trackObj, type, rate) {
    var padding = 45;
//    var margin = {top: 30, right: 20, bottom: 30, left: 50}
    var width = 640;
    var height = 280;

    var xScale = d3.scale.linear()
        .domain([
            type == "ElevVsTime" ? 0 : 0,
            type == "ElevVsTime" ? trackObj.totalTime : trackObj.totalDist
        ])
        .range([padding, width - padding]);

    var yScale = d3.scale.linear()
        .domain([trackObj.elevMin, trackObj.elevMax])
        .range([height - padding, (padding - 20)]);

    //create line function
    var line = d3.svg.line()
        .x(function (d) {
            return xScale(type == "ElevVsTime" ? d.timeProgress : d.currentDistVal);
        })
        .y(function (d) {
            return yScale(d.elev);
        })

    //add SVG
    var chart = d3.select("#charts").append('svg')
        .attr('id', type)
        .attr('width', width - (padding - 5))
        .attr('height', height - (padding - 20));

    //add the clip path
    chart.append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);

    //appending path element
    chart.append("path")
        .attr("d", line(trackObj.locations))
        .attr("stroke", "blue")
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .attr('clip-path', 'url(#clip)');

    //add "curtain" rect for reveal effect
    chart.append('rect')
        .attr('x', padding)
        .attr('y', 0)
        .attr('height', height)
        .attr('width', width)
        .style('fill', '#ffffff')
        .transition()
        .delay(500)
        .duration(rate || 5000)
        .ease('quad')
        .attr('x', width)


    //create xAxis
    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("bottom")
        .ticks(6)
        .tickFormat(
            type == "ElevVsTime" ?
            function (d) {
                return d.toFixed(1) + "h"
            } :
            function (d) {
                return d.toFixed(1) + "mi";
            }
        );

    //add x-axis
    chart.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + (height - padding) + ")")
        .call(xAxis);

    //create yAxis
    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient("left")
        .ticks(6)
        .tickFormat(function (d) {
            return d + "ft";
        });

    //add y-axis
    chart.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + (padding) + ",0)")
        .call(yAxis);


    //BEGIN SVG--PNG TRANSFORMATION
    //only run this using elevation vs distance
    if (type == "ElevVsDist") {

        d3.select("#ElevVsDist")
            .attr("version", 1.1)
            .attr("xmlns", "http://www.w3.org/2000/svg")

        d3.select("#charts").append('canvas')
            .attr("id", "pngoutput")
            .attr("width", width)
            .attr("height", height)

        //cherry picking parts of svg we want for img output
        var svgData = d3.select("#ElevVsDist").node().outerHTML;
        var svgTag = svgData.match(/<svg[^>]*>/);
        var pathTag = svgData.match(/<path d=[^>]*><\/path>/);

        //final svgdata to feed into b64 and canvas
        var svgForImg = svgTag + pathTag + "</svg>"

        //base64 encode into an svg+xml img
        var svg_xml_img_src = 'data:image/svg+xml;base64,' + btoa(svgForImg);

        var canvas = document.querySelector("#pngoutput"),
            context = canvas.getContext("2d");

        //create new img for canvas
        var image = new Image;
        image.src = svg_xml_img_src;
        image.onload = function () {
            context.drawImage(image, 0, 0);

            //encode img data as png
            var canvasdata = canvas.toDataURL("image/png");

            //send this to server where it will get stored in mongo if necessary
            Meteor.call('storeImgData', canvasdata, trackObj._id);

        };
    }
}