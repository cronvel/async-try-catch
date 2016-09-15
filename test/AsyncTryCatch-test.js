/*
	Async Try-Catch
	
	Copyright (c) 2015 - 2016 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

/* jshint unused:false */
/* global describe, it, before, after */



var AsyncTryCatch = require( '../lib/AsyncTryCatch.js' ) ;
var asyncTry = AsyncTryCatch.try ;

var Events = require( 'events' ) ;
var NextGenEvents = require( 'nextgen-events' ) ;

if ( process.browser )
{
	AsyncTryCatch.NodeEvents = Events ;
	AsyncTryCatch.NextGenEvents = NextGenEvents ;
}

var expect = require( 'expect.js' ) ;





			/* Tests */



describe( "Synchronous" , function() {
	
	it( "Sync" , function() {
		
		asyncTry( function syncTry() {
			throw new Error( 'sync error' ) ;
		} )
		.catch( function syncCatch( error ) {
			expect( error.message ).to.be( 'sync error' ) ;
		} ) ;
	} ) ;
	
	it( "Sync, nested" , function() {
		
		asyncTry( function syncNestedOuterTry() {
			asyncTry( function syncNestedInnerTry() {
				throw new Error( 'inner sync error' ) ;
			} )
			.catch( function syncNestedInnerCatch( error ) {
				expect( error.message ).to.be( 'inner sync error' ) ;
				throw new Error( 're-throw sync error' ) ;
			} ) ;
		} )
		.catch( function syncNestedOuterCatch( error ) {
			expect( error.message ).to.be( 're-throw sync error' ) ;
		} ) ;
	} ) ;
} ) ;


	
describe( "setTimeout() and friends" , function() {
	
	it( "setTimeout()" , function( done ) {
		
		asyncTry( function setTimeoutTry() {
			setTimeout( function setTimeoutTimeout() {
				throw new Error( 'setTimeout error' ) ;
			} , 0 ) ;
		} )
		.catch( function setTimeoutCatch( error ) {
			expect( error.message ).to.be( 'setTimeout error' ) ;
			done() ;
		} ) ;
	} ) ;
	
	it( "setImmediate()" , function( done ) {
		
		asyncTry( function() {
			setImmediate( function() {
				throw new Error( 'setImmediate error' ) ;
			} , 0 ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'setImmediate error' ) ;
			done() ;
		} ) ;
	} ) ;
	
	it( "process.nextTick()" , function( done ) {
		
		asyncTry( function() {
			process.nextTick( function() {
				throw new Error( 'nextTick error' ) ;
			} , 0 ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'nextTick error' ) ;
			done() ;
		} ) ;
	} ) ;
	
	it( "nested setTimeout" , function( done ) {
		
		asyncTry( function() {
			setTimeout( function() {
				setTimeout( function() {
					throw new Error( 'double setTimeout error' ) ;
				} , 0 ) ;
			} , 0 ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'double setTimeout error' ) ;
			done() ;
		} ) ;
	} ) ;
	
	it( "five nested setTimeout" , function( done ) {
		
		asyncTry( function() {
			setTimeout( function() {
				setTimeout( function() {
					setTimeout( function() {
						setTimeout( function() {
							setTimeout( function() {
								throw new Error( 'quintuple setTimeout error' ) ;
							} , 0 ) ;
						} , 0 ) ;
					} , 0 ) ;
				} , 0 ) ;
			} , 0 ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'quintuple setTimeout error' ) ;
			done() ;
		} ) ;
	} ) ;
	
	it( "nested setTimeout and async try catch, it should throw from the inner try, re-throw from the inner catch, bubble up to the outer catch" , function( done ) {
		
		asyncTry( function outerTry() {
			
			setTimeout( function outerTimeout() {
				
				asyncTry( function innerTry() {
					
					setTimeout( function innerTimeout() {
						throw new Error( 'inner setTimeout error' ) ;
					} , 0 ) ;
				} )
				.catch( function innerCatch( error ) {
					expect( error.message ).to.be( 'inner setTimeout error' ) ;
					//console.log( 'inner' , AsyncTryCatch.stack , "\n" ) ;
					throw new Error( 're-throw setTimeout error' ) ;
				} ) ;
			} , 0 ) ;
		} )
		.catch( function outerCatch( error ) {
			expect( error.message ).to.be( 're-throw setTimeout error' ) ;
			//console.log( 'outer' , AsyncTryCatch.stack ) ;
			done() ;
		} ) ;
	} ) ;
} ) ;



describe( "Node Events" , function() {
	
	it( "an exception thrown synchronously from a listener within an async-try closure should be catched" , function( done ) {
		
		var emitter = Object.create( Events.prototype ) ;
		
		asyncTry( function() {
			emitter.on( 'damage' , function() { throw new Error( 'argh!' ) ; } ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'argh!' ) ;
			done() ;
		} ) ;
		
		emitter.emit( 'damage' ) ;
	} ) ;
	
	it( "an exception thrown asynchronously from a listener within an async-try closure should be catched" , function( done ) {
		
		var emitter = Object.create( Events.prototype ) ;
		
		asyncTry( function() {
			emitter.on( 'damage' , function() {
				setTimeout( function() {
					throw new Error( 'delayed argh!' ) ;
				} , 0 ) ;
			} ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'delayed argh!' ) ;
			done() ;
		} ) ;
		
		emitter.emit( 'damage' ) ;
	} ) ;
	
	it( "once() should works as expected" , function() {
		
		var emitter = Object.create( Events.prototype ) ;
		var onDamage = function onDamage() { throw new Error( 'argh!' ) ; } ;
		
		var count = 0 ;
		
		asyncTry( function() {
			emitter.once( 'damage' , onDamage ) ;
			emitter.emit( 'damage' ) ;
			emitter.emit( 'damage' ) ;
		} )
		.catch( function( error ) {
			if ( count ++ ) { throw error ; }
		} ) ;
	} ) ;
	
	it( "removeListener() should works as expected" , function() {
		
		var emitter = Object.create( Events.prototype ) ;
		var onDamage = function onDamage() { throw new Error( 'argh!' ) ; } ;
		
		asyncTry( function() {
			emitter.on( 'damage' , onDamage ) ;
			emitter.removeListener( 'damage' , onDamage ) ;
			emitter.emit( 'damage' ) ;
		} )
		.catch( function( error ) {
			throw error ;
		} ) ;
	} ) ;
	
	it( "removeListener() on one-time listeners should works as expected" , function() {
		
		var emitter = Object.create( Events.prototype ) ;
		var onDamage = function onDamage() { throw new Error( 'argh!' ) ; } ;
		
		asyncTry( function() {
			emitter.once( 'damage' , onDamage ) ;
			emitter.removeListener( 'damage' , onDamage ) ;
			emitter.emit( 'damage' ) ;
		} )
		.catch( function( error ) {
			throw error ;
		} ) ;
	} ) ;
	
	//it( "isolate listener? (a throwing listener should not affect others listeners)" ) ;
} ) ;



describe( "NextGen Events" , function() {
	
	it( "an exception thrown synchronously from a listener within an async-try closure should be catched" , function( done ) {
		
		var emitter = Object.create( NextGenEvents.prototype ) ;
		
		asyncTry( function() {
			//emitter.on( 'damage' , function() { console.log( 'Damage event!' ) ; throw new Error( 'argh!' ) ; } ) ;
			emitter.on( 'damage' , function() { throw new Error( 'argh!' ) ; } ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'argh!' ) ;
			done() ;
		} ) ;
		
		emitter.emit( 'damage' ) ;
	} ) ;
	
	it( "an exception thrown asynchronously from a listener within an async-try closure should be catched" , function( done ) {
		
		var emitter = Object.create( NextGenEvents.prototype ) ;
		
		asyncTry( function() {
			emitter.on( 'damage' , function() {
				setTimeout( function() {
					throw new Error( 'delayed argh!' ) ;
				} , 0 ) ;
			} ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'delayed argh!' ) ;
			done() ;
		} ) ;
		
		emitter.emit( 'damage' ) ;
	} ) ;
	
	it( "should work using the listener object syntax" , function( done ) {
		
		var emitter = Object.create( NextGenEvents.prototype ) ;
		
		asyncTry( function() {
			emitter.on( 'damage' , { fn: function() { throw new Error( 'argh!' ) ; } } ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'argh!' ) ;
			done() ;
		} ) ;
		
		emitter.emit( 'damage' ) ;
	} ) ;
	
	it( "should work using the fn followed by an object syntax" , function( done ) {
		
		var emitter = Object.create( NextGenEvents.prototype ) ;
		
		asyncTry( function() {
			emitter.on( 'damage' , function() { throw new Error( 'argh!' ) ; } , {} ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'argh!' ) ;
			done() ;
		} ) ;
		
		emitter.emit( 'damage' ) ;
	} ) ;
	
	it( "should work with async listeners" , function( done ) {
		
		var emitter = Object.create( NextGenEvents.prototype , function() {
			console.log( 'Completed?' ) ;
		} ) ;
		
		asyncTry( function() {
			emitter.on( 'damage' , {
				async: true ,
				fn: function() {
					setTimeout( function() {
						throw new Error( 'delayed argh!' ) ;
					} ) ;
				}
			} ) ;
		} )
		.catch( function( error ) {
			expect( error.message ).to.be( 'delayed argh!' ) ;
			done() ;
		} ) ;
		
		emitter.emit( 'damage' ) ;
	} ) ;
	
	it( "once() should works as expected" , function() {
		
		var emitter = Object.create( NextGenEvents.prototype ) ;
		var onDamage = function onDamage() { throw new Error( 'argh!' ) ; } ;
		
		var count = 0 ;
		
		asyncTry( function() {
			emitter.once( 'damage' , onDamage ) ;
			emitter.emit( 'damage' ) ;
			emitter.emit( 'damage' ) ;
		} )
		.catch( function( error ) {
			if ( count ++ ) { throw error ; }
		} ) ;
	} ) ;
	
	it( "removeListener() should works as expected" , function() {
		
		var emitter = Object.create( NextGenEvents.prototype ) ;
		var onDamage = function onDamage() { throw new Error( 'argh!' ) ; } ;
		
		asyncTry( function() {
			emitter.on( 'damage' , onDamage ) ;
			emitter.removeListener( 'damage' , onDamage ) ;
			emitter.emit( 'damage' ) ;
		} )
		.catch( function( error ) {
			throw error ;
		} ) ;
	} ) ;
	
	it( "removeListener() on one-time listeners should works as expected" , function() {
		
		var emitter = Object.create( NextGenEvents.prototype ) ;
		var onDamage = function onDamage() { throw new Error( 'argh!' ) ; } ;
		
		asyncTry( function() {
			emitter.once( 'damage' , onDamage ) ;
			emitter.removeListener( 'damage' , onDamage ) ;
			emitter.emit( 'damage' ) ;
		} )
		.catch( function( error ) {
			throw error ;
		} ) ;
	} ) ;
} ) ;



describe( "Full NextGen Events test suite execution" , function() {
	require( 'nextgen-events/test/NextGenEvents-test.js' ) ;
} ) ;
	

