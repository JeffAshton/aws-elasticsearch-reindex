const _ = require( 'lodash' );
const fs = require( 'fs' ).promises;
const pathUtil = require( 'path' );

function getOutputPath( path ) {

	const pathInfo = pathUtil.parse( path );
	const isoNow = new Date().toISOString().replace( /:/g, '-' ); 

	const args = {
		dir: pathInfo.dir,
		name: `${ pathInfo.name }.${ isoNow }.tasks`,
		ext: '.json'
	};
	const outputPath = pathUtil.format( args );
	return outputPath;
}

module.exports = class Handler {

	constructor(
		elasticsearch,
		log
	) {

		this.elasticsearch = elasticsearch;
		this.log = log;
	}

	async handleAsync( path ) {
		const log = this.log;

		const json = await fs.readFile( path, { encoding: 'utf8' } );
		const commands = JSON.parse( json );

		let taskIds = [];
		let errors = 0;

		const reindexHelper = async ( command ) => {

			try {
				const taskId = await this.reindex( command );
				taskIds.push( taskId );

			} catch( err ) {
				log.error( { err, command }, 'failed to create reindex task' );
				errors++;
			}
		};

		if( _.isArray( commands ) ) {

			for( const command of commands ) {
				await reindexHelper( command );
			}

		} else if( _.isString( commands ) ) {
			await reindexHelper( commands );

		} else {
			throw new Error( 'invalid commands document' );
		}

		log.info( { taskIds }, 'created reindex tasks' );

		const outputPath = getOutputPath( path );
		const taskIdsJson = JSON.stringify( taskIds, null, '\t' );
		log.debug( { outputPath }, 'writing task ids output file' );
		await fs.writeFile( outputPath, taskIdsJson );

		return {
			outputPath,
			errors
		};
	}

	async reindex( command ) {

		const sourceIndex = _.get( command, 'source.index' );
		if( !sourceIndex ) {
			throw new Error( 'Command missing source.index' );
		}

		const destIndex = _.get( command, 'dest.index' );
		if( !destIndex ) {
			throw new Error( 'Command missing dest.index' );
		}

		const body = JSON.stringify( command );
		const bodyBuffer = Buffer.from( body, 'utf8' );

		const request = {
			method: 'POST',
			url: '/_reindex?wait_for_completion=false',
			body: bodyBuffer,
			headers: {
				'accept': 'application/json',
				'content-type': 'application/json'
			}
		};

		this.log.debug( { request }, 'creating reindex task' );
		const responseJson = await this.elasticsearch.sendAsync( request );
		const response = JSON.parse( responseJson );
		this.log.debug( { response }, 'created reindex task' );

		const taskId = response.task;
		if( !taskId ) {
			throw new Error( `Task not created for ${ sourceIndex } => ${ destIndex }` );
		}

		return taskId;
	}

	async getTask( taskId ) {

		const request = {
			method: 'GET',
			url: `/_tasks/${ encodeURIComponent( taskId ) }`,
			json: true
		};

		this.log.debug( { request }, 'getting task from elasticserach' );
		const response = await this.elasticsearch.sendAsync( request );
		this.log.debug( { response }, 'got task from elasticserach' );

		return response;
	}
};
