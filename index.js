const aws = require( 'aws-sdk' );
const fetch = require( 'node-fetch' );
const replaceAsync = require( 'string-replace-async' );

const s3 = new aws.S3( { region: 'us-east-1' } );
const params = {
  bucketName: '<BUCKETNAME>',
  config: 'components.json'
};

let components;

/**
 * Gets a component list from an S3 bucket
 * 
 * @return parsed JSON format of components
 */
const getComponents = async() => {
    try {
        const s3Params = {
            Bucket: params.bucketName,
            Key: params.config
        };
        const response = await s3.getObject( s3Params ).promise();
        return JSON.parse( response.Body.toString( 'utf-8' ) );
    } catch ( error ) {
        console.error( `Failed to read components.json: ${ error.message }` );
    }
};

/**
 * Gets a single component object from an array
 * 
 * @param  name  the name of the component to find
 * @return component object with base, style and script
 */
const getComponent = ( name ) => {
    return components.find( component => component.name === name );
};

/**
 * Get a file from the S3 bucket by name
 * 
 * @param  filename  the name of the file to get
 * @return files contents as a string
 */
const getFile = async( filename ) => {
    try {
        const s3Params = {
            Bucket: params.bucketName,
            Key: filename
        };
        const file = await s3.getObject( s3Params ).promise();
        return file.Body.toString( 'utf-8' );
    } catch ( error ) {
        console.error( `Failed to read file: ${ error.message }` );
    }
};

/**
 * Find and replace all lambda comments
 * 
 * @param  body  the html body to find and replace
 * @return the updated html body with its components
 */
const replaceTags = async( body ) => {
    
    // Lookup HTML comments i.e. <!-- lambda.navigation -->
    const replaceRule = /<!--\{\{lambda\.(\w*)\}\}-->/;
    let component;
    let replaced = await replaceAsync( body, replaceRule, async( match, name ) => {
        component = getComponent( name );
        return await getFile( component.base );
    });

    // Append styles if a css file is present
    if ( component.style ) {
        replaced = appendStyles( replaced, component.style );
    }

    // Append scripts if a JS file is present
    if ( component.script ) {
        replaced = appendScript( replaced, component.script );
    }

    return replaced;
};

/**
 * Add a string before another string
 * 
 * @param  string  the existing string to update
 * @param  addition  the new string to append
 * @param  index  usually the indexOf to inject the new string
 * @return the updated string with the additional new string
 */
const splice_into = ( string, addition, index ) => {
    return string.substring( 0, index ) + addition + string.substring( index );
  }

/**
 * Append component styles to document <head>
 * 
 * @param  html  the html body to find and replace
 * @param  filename  the css filename
 * @return the updated html body with its styles
 */
const appendStyles = async( html, filename ) => {
    const index = html.indexOf( '</head>' );

    let styles = await getFile( filename );
    styles = `<style>${ styles }</style>`
    
    return splice_into( html, styles, index );
};

/**
 * Append component script to document <head>
 * 
 * @param  html  the html body to find and replace
 * @param  filename  the css filename
 * @return the updated html body with its styles
 */
const appendScript = async( html, filename ) => {
    const index = html.indexOf( '</head>' );

    let script = await getFile( filename );
    script = `<script>${ script }</script>`
    
    return splice_into( html, script, index );
};

/**
 * Fetch index HTML to run find and replace on
 * 
 * @param  URL  the index page URL to crawl
 * @return the updated index html to serve to users
 */
const getIndex = async( URL ) => {
    const response = await fetch(URL);
    const body = await response.text();
    const updated = await replaceTags( body );
    return updated;
};

exports.handler = async ( event, context ) => {

    const request = event.Records[0].cf.request;
    const headers = request.headers;
    const host = headers['host'][0].value;
    const uri = request.uri;

    // Only act on requests to root
    if ( uri === '/' ) {

        // Cache components list and get HTML body
        components = await getComponents();

        // TODO: Could this reference via host + uri ?
        const body = await getIndex('https://<BUCKET-URL>/index.html');

        return {
            body: body,
            bodyEncoding: 'text',
            status: '200',
            statusDescription: 'OK',
            headers: {
                'cache-control': [
                    {
                        'key': 'Cache-Control',
                        'value': 'max-age=300'
                    }
                ]
            }
        };
    } else {
        return request;
    }
};