
// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
// Parse.Cloud.define("hello", function(request, response) {
//   response.success("Hello world!");
// });

var Image = require("parse-image");
// PhotoCompressTest
// Step
Parse.Cloud.beforeSave("Step", function(request, response) {
    var step = request.object;
    if (!step.get("photo")) {
        response.success();
        return;
    } else {

        if (!step.dirty("photo")) {
            // The profile photo isn't being modified.
            response.success();
            return;
        }

        var promises = [
            ProcessUrls(step.get("photo").url(), {width:800,height:800})
        ];
        
        return Parse.Promise
            .when(promises)
            .then(function() {
                // results are passed as function arguments
                // map processed photos to result
                var photos = Array.prototype.slice.call(arguments);
                var result = {};
                console.log("promises:" + promises);

                photos.forEach(function(photo) {
                    // console.log("photo.key: " + photo.key)
                    result[photo.key] = photo;

                    step.set('compressedPhoto', photo.file);

                });
                response.success();
            }, function(error) {
                response.error("error: " + error);
            });
    } 
});

function ProcessUrls(fullUrl, size, obj) {
    return Parse.Cloud.httpRequest({
            url: fullUrl
        })
        .then(function(response) {
            var image = new Image();
            return image.setData(response.buffer);

        })
        .then(function(image) {
            var maxsize = Math.max(image.width(), image.height());
            var w = size['width'];
            var h = size['height'];

            if(maxsize > w || maxsize > h){
                var ratio = 0;
                if(image.width() == maxsize){
                    ratio = image.height() / maxsize;
                    h = w * ratio;
                }else{
                    ratio = image.width() / maxsize;
                    w = h * ratio;
                }
                return image.scale({width: w,height: h});
            }else{
                return image;
            }
        })
        .then(function(image) {
            // Make sure it's a JPEG to save disk space and bandwidth.
            return image.setFormat("JPEG");
        })
        .then(function(image) {
            // Get the image data in a Buffer.
            return image.data();
        }).then(function(buffer) {
            // Save the image into a new file.
            var base64 = buffer.toString("base64");
            var cropped = new Parse.File("compressedPhoto.jpg", {
                base64: base64
            });
            return cropped.save()
                .then(function(file) {
                    // this object is passed to promise below
                    return {
                        key: 'compressed',
                        file: file,
                        obj: obj
                    };
                });
        });
};

Parse.Cloud.define("migrateExistingPhoto", function(request, response) {
    var falseQuery = new Parse.Query('Step');
    var undefinedQuery = new Parse.Query('Step');
    falseQuery.equalTo('compressedPhoto', false);
    undefinedQuery.doesNotExist('compressedPhoto');

    //this is the query you should run
    var query = Parse.Query.or(falseQuery, undefinedQuery);
    query.find({
        success: function(results) {
            var sum = 0;
            var promises = [];
            for (var i = 0; i < results.length; ++i) {
                // sum += results[i].get("stars");
                promises.push(ProcessUrls(results[i].get("photo").url(), {width:800,height:800}, results[i]));
            }
            Parse.Promise
                .when(promises)
                .then(function() {
                    // results are passed as function arguments
                    // map processed photos to result
                    var photos = Array.prototype.slice.call(arguments);
                    var result = {};
                    console.log("promises:" + promises);

                    photos.forEach(function(photo) {
                        // console.log("photo.key: " + photo.key)
                        // result[photo.key] = photo;

                        photo.obj.set('compressedPhoto', photo.file);

                    });
                    response.success("OK");
                }, function(error) {
                    response.error("error: " + error);
                });
            // response.success(sum / results.length);
        },
        error: function() {
            response.error("error");
        }
    });
});

