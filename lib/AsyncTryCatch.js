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

"use strict" ;



function AsyncTryCatch() { throw new Error( "Use AsyncTryCatch.try() instead." ) ; }
module.exports = AsyncTryCatch ;
global.AsyncTryCatch = AsyncTryCatch ;



if ( process.browser && ! global.setImmediate )
{
	global.setImmediate = function setImmediate( fn ) { return setTimeout( fn , 0 ) ; } ;
	global.clearImmediate = function clearImmediate( timer ) { return clearTimeout( timer ) ; } ;
}



if ( ! global.Vanilla )
{
	global.Vanilla = {} ;
	
	if ( ! global.Vanilla.setTimeout ) { global.Vanilla.setTimeout = setTimeout ; }
	if ( ! global.Vanilla.setImmediate ) { global.Vanilla.setImmediate = setImmediate ; }
	if ( ! global.Vanilla.nextTick ) { global.Vanilla.nextTick = process.nextTick ; }
	//if ( ! global.Vanilla.Error ) { global.Vanilla.Error = Error ; }
}

AsyncTryCatch.stack = [] ;
AsyncTryCatch.substituted = false ;



AsyncTryCatch.try = function try_( fn )
{
	var self = Object.create( AsyncTryCatch.prototype , {
		fn: { value: fn , enumerable: true } ,
		parent: { value: AsyncTryCatch.stack[ AsyncTryCatch.stack.length - 1 ] }
	} ) ;
	
	return self ;
} ;



AsyncTryCatch.prototype.catch = function catch_( catchFn )
{
	Object.defineProperties( this , {
		catchFn: { value: catchFn , enumerable: true }
	} ) ;
	
	if ( ! AsyncTryCatch.substituted ) { AsyncTryCatch.substitute() ; }
	
	try {
		AsyncTryCatch.stack.push( this ) ;
		this.fn() ;
		AsyncTryCatch.stack.pop() ;
	}
	catch ( error ) {
		AsyncTryCatch.stack.pop() ;
		this.callCatchFn( error ) ;
	}
	
} ;



// Handle the bubble up
AsyncTryCatch.prototype.callCatchFn = function callCatchFn( error )
{
	if ( ! this.parent )
	{
		this.catchFn( error ) ;
		return ;
	}
	
	try {
		AsyncTryCatch.stack.push( this.parent ) ;
		this.catchFn( error ) ;
		AsyncTryCatch.stack.pop() ;
	}
	catch ( error ) {
		AsyncTryCatch.stack.pop() ;
		this.parent.callCatchFn( error ) ;
	}
} ;



// for setTimeout(), setImmediate(), process.nextTick()
AsyncTryCatch.timerWrapper = function timerWrapper( originalMethod , fn )
{
	var fn , context , wrapperFn ,
		args = Array.prototype.slice.call( arguments , 1 ) ;
	
	if ( typeof fn !== 'function' || ! AsyncTryCatch.stack.length )
	{
		return originalMethod.apply( this , args ) ;
	}
	
	context = AsyncTryCatch.stack[ AsyncTryCatch.stack.length - 1 ] ;
	
	wrapperFn = function() {
		try {
			AsyncTryCatch.stack.push( context ) ;
			fn.apply( this , arguments ) ;
			AsyncTryCatch.stack.pop() ;
		}
		catch ( error ) {
			AsyncTryCatch.stack.pop() ;
			context.callCatchFn( error ) ;
		}
	} ;
	
	args[ 0 ] = wrapperFn ;
	
	return originalMethod.apply( this , args ) ;
} ;



// for Node-EventEmitter-compatible .addListener()
AsyncTryCatch.addListenerWrapper = function addListenerWrapper( originalMethod , eventName , fn , options )
{
	var fn , context , wrapperFn ;
	
	// NextGen event compatibility
	if ( typeof fn === 'object' )
	{
		options = fn ;
		fn = options.fn ;
		delete options.fn ;
	}
	
	if ( typeof fn !== 'function' || ! AsyncTryCatch.stack.length )
	{
		return originalMethod.call( this , eventName , fn , options ) ;
	}
	
	context = AsyncTryCatch.stack[ AsyncTryCatch.stack.length - 1 ] ;
	
	// Assume that the function is only wrapped once per eventEmitter
	if ( this.__fnToWrapperMap )
	{
		wrapperFn = this.__fnToWrapperMap.get( fn ) ;
	}
	else 
	{
		// Create the map, make it non-enumerable
		Object.defineProperty( this , '__fnToWrapperMap', { value: new WeakMap() } ) ;
	}
	
	if ( ! wrapperFn )
	{
		wrapperFn = function() {
			try {
				AsyncTryCatch.stack.push( context ) ;
				fn.apply( this , arguments ) ;
				AsyncTryCatch.stack.pop() ;
			}
			catch ( error ) {
				AsyncTryCatch.stack.pop() ;
				context.callCatchFn( error ) ;
			}
		} ;
		
		this.__fnToWrapperMap.set( fn , wrapperFn ) ;
	}
	
	return originalMethod.call( this , eventName , wrapperFn , options ) ;
} ;



AsyncTryCatch.removeListenerWrapper = function removeListenerWrapper( originalMethod , eventName , fn )
{
	//console.log( 'fn:' , fn ) ;
	
	if ( typeof fn === 'function' && this.__fnToWrapperMap )
	{
		fn = this.__fnToWrapperMap.get( fn ) || fn ;
	}
	
	return originalMethod.call( this , eventName , fn ) ;
} ;



AsyncTryCatch.setTimeout = AsyncTryCatch.timerWrapper.bind( undefined , global.Vanilla.setTimeout ) ;
AsyncTryCatch.setImmediate = AsyncTryCatch.timerWrapper.bind( undefined , global.Vanilla.setImmediate ) ;
AsyncTryCatch.nextTick = AsyncTryCatch.timerWrapper.bind( process , global.Vanilla.nextTick ) ;

// NodeEvents on()/addListener() replacement
AsyncTryCatch.addListener = function addListener( eventName , fn )
{
	AsyncTryCatch.addListenerWrapper.call( this , AsyncTryCatch.NodeEvents.__addListener , eventName , fn ) ;
} ;

// NodeEvents once() replacement
AsyncTryCatch.addListenerOnce = function addListenerOnce( eventName , fn )
{
	try {
	AsyncTryCatch.addListenerWrapper.call( this , AsyncTryCatch.NodeEvents.__addListenerOnce , eventName , fn ) ;
	} catch ( error ) {
		console.log( AsyncTryCatch.NodeEvents ) ;
		console.log( AsyncTryCatch.NodeEvents.__addListenerOnce ) ;
		throw error ;
	}
} ;

// NodeEvents removeListener() replacement
AsyncTryCatch.removeListener = function removeListener( eventName , fn )
{
	AsyncTryCatch.removeListenerWrapper.call( this , AsyncTryCatch.NodeEvents.__removeListener , eventName , fn ) ;
} ;

// NextGen Events on()/addListener() replacement
AsyncTryCatch.ngevAddListener = function ngevAddListener( eventName , fn , options )
{
	AsyncTryCatch.addListenerWrapper.call( this , AsyncTryCatch.NextGenEvents.on , eventName , fn , options ) ;
} ;

// NextGen Events once() replacement
AsyncTryCatch.ngevAddListenerOnce = function ngevAddListenerOnce( eventName , fn , options )
{
	AsyncTryCatch.addListenerWrapper.call( this , AsyncTryCatch.NextGenEvents.once , eventName , fn , options ) ;
} ;

// NextGen Events off()/removeListener() replacement
AsyncTryCatch.ngevRemoveListener = function ngevRemoveListener( eventName , fn )
{
	AsyncTryCatch.removeListenerWrapper.call( this , AsyncTryCatch.NextGenEvents.off , eventName , fn ) ;
} ;



AsyncTryCatch.substitute = function substitute()
{
	// This test should be done by the caller, because substitution could be incomplete
	// E.g. browser case: Node Events or NextGen Events are not loaded/accessible at time
	
	//if ( AsyncTryCatch.substituted ) { return ; }
	AsyncTryCatch.substituted = true ;
	
	global.setTimeout = AsyncTryCatch.setTimeout ;
	global.setImmediate = AsyncTryCatch.setTimeout ;
	process.nextTick = AsyncTryCatch.nextTick ;
	
	// Global is checked first, in case we are running inside a browser
	try {
		AsyncTryCatch.NodeEvents = global.EventEmitter || require( 'events' ) ;
	} catch ( error ) {}
	
	try {
		AsyncTryCatch.NextGenEvents = global.NextGenEvents || require( 'nextgen-events' ) ;
	} catch ( error ) {}
	
	if ( AsyncTryCatch.NodeEvents )
	{
		if ( ! AsyncTryCatch.NodeEvents.__addListener )
		{
			AsyncTryCatch.NodeEvents.__addListener = AsyncTryCatch.NodeEvents.prototype.on ;
		}
		
		if ( ! AsyncTryCatch.NodeEvents.__addListenerOnce )
		{
			AsyncTryCatch.NodeEvents.__addListenerOnce = AsyncTryCatch.NodeEvents.prototype.once ;
		}
		
		if ( ! AsyncTryCatch.NodeEvents.__removeListener )
		{
			AsyncTryCatch.NodeEvents.__removeListener = AsyncTryCatch.NodeEvents.prototype.removeListener ;
		}
		
		AsyncTryCatch.NodeEvents.prototype.on = AsyncTryCatch.addListener ;
		AsyncTryCatch.NodeEvents.prototype.addListener = AsyncTryCatch.addListener ;
		AsyncTryCatch.NodeEvents.prototype.once = AsyncTryCatch.addListenerOnce ;
		AsyncTryCatch.NodeEvents.prototype.removeListener = AsyncTryCatch.removeListener ;
	}
	
	//global.Error = AsyncTryCatch.Error ;
	// Should do that for all error types, cause they will not inherit from the substituted constructor
	
	if ( AsyncTryCatch.NextGenEvents )
	{
		AsyncTryCatch.NextGenEvents.prototype.on = AsyncTryCatch.ngevAddListener ;
		AsyncTryCatch.NextGenEvents.prototype.addListener = AsyncTryCatch.ngevAddListener ;
		AsyncTryCatch.NextGenEvents.prototype.once = AsyncTryCatch.ngevAddListenerOnce ;
		AsyncTryCatch.NextGenEvents.prototype.off = AsyncTryCatch.ngevRemoveListener ;
		AsyncTryCatch.NextGenEvents.prototype.removeListener = AsyncTryCatch.ngevRemoveListener ;
	}
} ;



AsyncTryCatch.restore = function restore()
{
	// This test should be done by the caller, because substitution could be incomplete
	// E.g. browser case: Node Events or NextGen Events are not loaded/accessible at time
	
	//if ( ! AsyncTryCatch.substituted ) { return ; }
	AsyncTryCatch.substituted = false ;
	
	global.setTimeout = global.Vanilla.setTimeout ;
	global.setImmediate = global.Vanilla.setImmediate ;
	process.nextTick = global.Vanilla.nextTick ;
	
	if ( AsyncTryCatch.NodeEvents )
	{
		AsyncTryCatch.NodeEvents.prototype.on = AsyncTryCatch.NodeEvents.__addListener ;
		AsyncTryCatch.NodeEvents.prototype.addListener = AsyncTryCatch.NodeEvents.__addListener ;
		AsyncTryCatch.NodeEvents.prototype.once = AsyncTryCatch.NodeEvents.__addListenerOnce ;
		AsyncTryCatch.NodeEvents.prototype.removeListener = AsyncTryCatch.NodeEvents.__removeListener ;
	}
	
	//global.Error = global.Vanilla.Error ;
	
	if ( AsyncTryCatch.NextGenEvents )
	{
		AsyncTryCatch.NextGenEvents.prototype.on = AsyncTryCatch.NextGenEvents.on ;
		AsyncTryCatch.NextGenEvents.prototype.addListener = AsyncTryCatch.NextGenEvents.on ;
		AsyncTryCatch.NextGenEvents.prototype.once = AsyncTryCatch.NextGenEvents.once ;
		AsyncTryCatch.NextGenEvents.prototype.off = AsyncTryCatch.NextGenEvents.off ;
		AsyncTryCatch.NextGenEvents.prototype.removeListener = AsyncTryCatch.NextGenEvents.removeListener ;
	}
} ;



/*
AsyncTryCatch.Error = function Error( message )
{
	global.Vanilla.Error.call( this ) ;
	global.Vanilla.Error.captureStackTrace && global.Vanilla.Error.captureStackTrace( this , this.constructor ) ; // jshint ignore:line
	
	Object.defineProperties( this , {
		message: { value: message , writable: true } ,
		id: { value: '' + Math.floor( Math.random( 1000000 ) ) }
	} ) ;
} ;

AsyncTryCatch.Error.prototype = Object.create( global.Vanilla.Error.prototype ) ;
AsyncTryCatch.Error.prototype.constructor = AsyncTryCatch.Error ;
*/



