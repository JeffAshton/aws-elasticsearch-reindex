const _ = require( 'lodash' );
const AWS = require( 'aws-sdk' );
const request = require( 'request-promise' );
const urlLib = require( 'url' );

function getAwsCredentialsProviderAsync() {

	return new Promise( ( resolve, reject ) => {

		const chain = new AWS.CredentialProviderChain();
		chain.resolve( ( resolveErr, provider ) => {

			if( resolveErr ) {
				return reject( resolveErr );
			}

			return provider.get( getErr => {

				if( getErr ) {
					return reject( getErr );
				}
				
				return resolve( provider );
			} );
		} );
	} );
}

module.exports = class AwsElasticsearchClient {

	constructor(
		awsRegion,
		elasticsearchUrl
	) {

		this.awsRegion = awsRegion;

		const esUrlInfo = urlLib.parse( elasticsearchUrl );
		this.elasticsearchHost = esUrlInfo.hostname;
		this.elasticsearchUrl = elasticsearchUrl;

		this.httpClient = request.defaults( {
			baseUrl: elasticsearchUrl
		} );
	}

	async sendAsync( request ) {
		
		const req = _.cloneDeep( request );

		const awsCredentialsPromise = getAwsCredentialsProviderAsync();

		const signingReq = new AWS.HttpRequest( this.elasticsearchUrl );
		signingReq.method = req.method;
		signingReq.path = req.url;
		signingReq.region = this.awsRegion;

		if( !signingReq.headers ) {
			signingReq.headers = {};
		}
		signingReq.headers.Host = this.elasticsearchHost;

		if( Buffer.isBuffer( req.body ) ) {
			signingReq.body = req.body;
		}

		const signer = new AWS.Signers.V4( signingReq, 'es' );

		const awsCredentials = await awsCredentialsPromise;
		signer.addAuthorization( awsCredentials, new Date() );

		if( !req.headers ) {
			req.headers = {};
		}

		_.forIn( signingReq.headers, ( value, key ) => {
			req.headers[ key ] = value;
		} );

		return this.httpClient( req );
	}
};
