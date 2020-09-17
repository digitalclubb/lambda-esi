# CloudFront Edge Side Include (ESI) via Lambda@Edge
> A proof of concept (POC) to read and compile components from an S3 bucket

## AWS Services
* [CloudFront](https://aws.amazon.com/cloudfront/) to use as CDN for caching strategy
* [Lambda@Edge](https://aws.amazon.com/lambda/edge/) to compile code on the fly
* [S3 bucket](https://aws.amazon.com/s3/) to store component code

## Overview

> This is a work in progress.

For some unknown reason CloudFront don't seem to offer ESIs out of the box. 
The majority of other mainstream CDN providers seem to have this covered.

For those companies and individuals that are already invested heavily in the AWS infrastructure,
I've knocked up a POC to see if it was possible to use Lambda@Edge to generate a page on the fly and to be cached for a reasonable time.

The general idea here is we can add a comment to our pages (`!--{{lambda.component}}-->`) and Lambda@Edge will populate them with the right component data which it will take from an S3 bucket.

## Requirements

### S3 Bucket

To get going, you will need to have an S3 bucket setup. You will need to [enable website hosting](https://docs.aws.amazon.com/AmazonS3/latest/dev/EnableWebsiteHosting.html).

The bucket should contain files in the following format and structure:

#### components.json

The Lambda will look to read a reference file of the components that it needs to embed.
I've thrown this configuration into a JSON file in the following format:

```
[
    {
        "name": "navigation",
        "base": "navigation.html",
        "style": "navigation.css",
        "script": "navigation.js"
    }
]
```
`name` and `base` would be a the minimum required. The other key/value pairs can be omiited if not required.

#### component.html, css and js

This should just be the raw code to be included. The Lambda will use the aws-sdk to read the file and append the data to the main index file.

An example of `navigation.html` would look like this:

```
<nav>
    <ul>
        <li>
            <a href="/">Home</a>
        </li>
        <li>
            <a href="/properties">Properties</a>
        </li>
        <li>
            <a href="/contacts" data-click>Contacts</a>
        </li>
    </ul>
</nav>
```

### index.html

This is an important file. The CloudFront distribution is used to [serve static files hosted on S3](https://aws.amazon.com/premiumsupport/knowledge-center/cloudfront-serve-static-website/).
We add an index.html file here for the POC for CloudFront to read and then update with the ESI content.

The file should look like the following:

```
<!DOCTYPE html>
<html lang="en">
  <head>

    <title>Amazing website</title>

  </head>
  <body>

   <!--{{lambda.navigation}}-->

  </body>
</html>
```

The comment `<!--{{lambda.navigation}}-->` is the most important part. This is our ESI tag.

The Lambda function will look for such comments and use the name, in this case 'navigation', and look up the `name` within the `components.json` configuration file.

## Deployment

This will be ported to something like [Serverless Framework](https://www.serverless.com/) in future but for now I have been manually creating a ZIP file and uploading this to the Lambda:

```
zip -r function.zip . -x '*.git/*'
```

## Future considerations

* should bundles be included via path and not inlined?
* how do we avoid clashes of styling/script?
* what should the caching rules look like?