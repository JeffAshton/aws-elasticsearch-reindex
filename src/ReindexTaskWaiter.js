const _ = require( 'lodash' );
const fs = require( 'fs' ).promises;
const Promise = require( 'bluebird' );

function validateTaskResponse( response, log ) {

	const timedOut = response.timed_out;
	if ( !_.isBoolean( timedOut ) ) {
		log.error( 'task response missing timed_out property' );
		return false;
	}

	if ( timedOut ) {
		log.error( 'task timed out' );
		return false;
	}

	// ---------------------------------------------------------------

	const versionConflicts = response.version_conflicts;
	if( !_.isNumber( versionConflicts ) ) {
		log.error( 'task response missing version_conflicts property' );
		return false;
	}

	if ( versionConflicts > 0 ) {
		log.error( { failures }, 'task had version conflicts' );
		return false;
	}
	
	// ---------------------------------------------------------------

	const failures = response.failures;
	if( !_.isArray( failures ) ) {
		log.error( 'task response missing failures property' );
		return false;
	}

	if ( failures.length > 0 ) {
		log.error( { failures }, 'task had failures' );
		return false;
	}
	
	// ---------------------------------------------------------------

	log.info( 'task completed succsesfully' );
	return true;
}

module.exports = class Handler {

	constructor(
		elasticsearch,
		log
	) {

		this.elasticsearch = elasticsearch;
		this.log = log;
	}

	async waitOnTasks( path ) {

		const json = await fs.readFile( path, { encoding: 'utf8' } );
		const taskIds = JSON.parse( json );

		const tasks = await Promise.map(
			taskIds,
			taskId => this.waitOnTaskResponse( taskId ),
			{
				concurrency: 8
			}
		);

		let errors = 0;

		for ( const task of tasks ) {

			const taskLog = this.log.child( {
				taskId: task.taskId
			} );

			const valid = validateTaskResponse( task.response, taskLog );
			if ( !valid ) {
				errors++;
			}
		}

		return {
			errorCount: errors
		};
	}

	async waitOnTaskResponse( taskId ) {

		for ( ; ; ) {

			const task = await this.getTask( taskId );
			if ( task.completed ) {

				return {
					taskId: taskId,
					response: task.response
				};

			} else {

				const status = task.task.status;
				const progress = Math.round( status.created / status.total * 100 );

				this.log.info(
					{
						taskId,
						progress: `${progress}%`
					},
					'task still executing'
				);
			}

			await Promise.delay( 5000 );
		}
	}

	async getTask( taskId ) {

		const request = {
			method: 'GET',
			url: `/_tasks/${encodeURIComponent( taskId )}`,
			json: true
		};

		this.log.debug( { request }, 'getting task from elasticserach' );
		const response = await this.elasticsearch.sendAsync( request );
		this.log.debug( { response }, 'got task from elasticserach' );

		return response;
	}
};
