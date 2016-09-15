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
AsyncTryCatch.prototype.__prototypeUID__ = 'async-try-catch/AsyncTryCatch' ;
AsyncTryCatch.prototype.__prototypeVersion__ = require( '../package.json' ).version ;



if ( global.AsyncTryCatch )
{
	if ( global.AsyncTryCatch.prototype.__prototypeUID__ === 'async-try-catch/AsyncTryCatch' )
	{
		//console.log( "Already installed:" , global.AsyncTryCatch.prototype.__prototypeVersion__ , "current:" , AsyncTryCatch.prototype.__prototypeVersion__ ) ;
		
		var currentVersions = AsyncTryCatch.prototype.__prototypeVersion__.split( '.' ) ;
		var installedVersions = global.AsyncTryCatch.prototype.__prototypeVersion__.split( '.' ) ;
		
		// Basic semver comparison
		if (
			installedVersions[ 0 ] !== currentVersions[ 0 ] ||
			( currentVersions[ 0 ] === "0" && installedVersions[ 1 ] !== currentVersions[ 1 ] )
		)
		{
			throw new Error(
				"Incompatible version of AsyncTryCatch already installed on global.AsyncTryCatch: " +
				global.AsyncTryCatch.prototype.__prototypeVersion__ +
				", current version: " + AsyncTryCatch.prototype.__prototypeVersion__
			) ;
		}
		//global.AsyncTryCatch = AsyncTryCatch ;
	}
	else
	{
		throw new Error( "Incompatible module already installed on global.AsyncTryCatch" ) ;
	}
}
else
{
	global.AsyncTryCatch = AsyncTryCatch ;
	global.AsyncTryCatch.stack = [] ;
	global.AsyncTryCatch.substituted = false ;
	global.AsyncTryCatch.NextGenEvents = [] ;
}



if ( process.browser && ! global.setImmediate )
{
	global.setImmediate = function setImmediate( fn ) { return setTimeout( fn , 0 ) ; } ;
	global.clearImmediate = function clearImmediate( timer ) { return clearTimeout( timer ) ; } ;
}



if ( ! global.Vanilla ) { global.Vanilla = {} ; }
if ( ! global.Vanilla.setTimeout ) { global.Vanilla.setTimeout = setTimeout ; }
if ( ! global.Vanilla.setImmediate ) { global.Vanilla.setImmediate = setImmediate ; }
if ( ! global.Vanilla.nextTick ) { global.Vanilla.nextTick = process.nextTick ; }



AsyncTryCatch.try = function try_( fn )
{
	var self = Object.create( AsyncTryCatch.prototype , {
		fn: { value: fn , enumerable: true } ,
		parent: { value: global.AsyncTryCatch.stack[ global.AsyncTryCatch.stack.length - 1 ] }
	} ) ;
	
	return self ;
} ;



AsyncTryCatch.prototype.catch = function catch_( catchFn )
{
	Object.defineProperties( this , {
		catchFn: { value: catchFn , enumerable: true }
	} ) ;
	
	if ( ! global.AsyncTryCatch.substituted ) { AsyncTryCatch.substitute() ; }
	
	try {
		global.AsyncTryCatch.stack.push( this ) ;
		this.fn() ;
		global.AsyncTryCatch.stack.pop() ;
	}
	catch ( error ) {
		global.AsyncTryCatch.stack.pop() ;
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
		global.AsyncTryCatch.stack.push( this.parent ) ;
		this.catchFn( error ) ;
		global.AsyncTryCatch.stack.pop() ;
	}
	catch ( error ) {
		global.AsyncTryCatch.stack.pop() ;
		this.parent.callCatchFn( error ) ;
	}
} ;



// for setTimeout(), setImmediate(), process.nextTick()
AsyncTryCatch.timerWrapper = function timerWrapper( originalMethod , fn )
{
	var fn , context , wrapperFn ,
		args = Array.prototype.slice.call( arguments , 1 ) ;
	
	if ( typeof fn !== 'function' || ! global.AsyncTryCatch.stack.length )
	{
		return originalMethod.apply( this , args ) ;
	}
	
	context = global.AsyncTryCatch.stack[ global.AsyncTryCatch.stack.length - 1 ] ;
	
	wrapperFn = function() {
		try {
			global.AsyncTryCatch.stack.push( context ) ;
			return fn.apply( this , arguments ) ;
			global.AsyncTryCatch.stack.pop() ;
		}
		catch ( error ) {
			global.AsyncTryCatch.stack.pop() ;
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
	
	if ( typeof fn !== 'function' || ! global.AsyncTryCatch.stack.length )
	{
		return originalMethod.call( this , eventName , fn , options ) ;
	}
	
	context = global.AsyncTryCatch.stack[ global.AsyncTryCatch.stack.length - 1 ] ;
	
	// Make sure that the function is only wrapped once per eventEmitter
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
				global.AsyncTryCatch.stack.push( context ) ;
				return fn.apply( this , arguments ) ;
				global.AsyncTryCatch.stack.pop() ;
			}
			catch ( error ) {
				global.AsyncTryCatch.stack.pop() ;
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
	
	/*
	if ( typeof fn === 'function' && this.__fnToWrapperMap )
	{
		fn = this.__fnToWrapperMap.get( fn ) || fn ;
	}
	*/
	
	return originalMethod.call( this , eventName , fn ) ;
} ;



AsyncTryCatch.setTimeout = AsyncTryCatch.timerWrapper.bind( undefined , global.Vanilla.setTimeout ) ;
AsyncTryCatch.setImmediate = AsyncTryCatch.timerWrapper.bind( undefined , global.Vanilla.setImmediate ) ;
AsyncTryCatch.nextTick = AsyncTryCatch.timerWrapper.bind( process , global.Vanilla.nextTick ) ;

// NodeEvents on()/addListener() replacement
AsyncTryCatch.addListener = function addListener( eventName , fn )
{
	return AsyncTryCatch.addListenerWrapper.call( this , AsyncTryCatch.NodeEvents.__addListener , eventName , fn ) ;
} ;

// NodeEvents once() replacement
AsyncTryCatch.addListenerOnce = function addListenerOnce( eventName , fn )
{
	return AsyncTryCatch.addListenerWrapper.call( this , AsyncTryCatch.NodeEvents.__addListenerOnce , eventName , fn ) ;
} ;

// NodeEvents removeListener() replacement
AsyncTryCatch.removeListener = function removeListener( eventName , fn )
{
	return AsyncTryCatch.removeListenerWrapper.call( this , AsyncTryCatch.NodeEvents.__removeListener , eventName , fn ) ;
} ;

// NextGen Events on()/addListener() replacement
AsyncTryCatch.ngevAddListener = function ngevAddListener( eventName , fn , options )
{
	/*
	console.log( 'this:' , this ) ;
	console.log( 'this.asyncTryCatchId:' , this.asyncTryCatchId ) ;
	console.log( 'called with:' , Array.from( arguments ) ) ;
	try {*/
	if ( ! options ) { options = {} ; }
	if ( options.id === undefined ) { options.id = fn ; }
	
	return AsyncTryCatch.addListenerWrapper.call( this ,
		AsyncTryCatch.NextGenEvents[ this.asyncTryCatchId ].on ,
		eventName , fn , options ) ;
	/*}
	catch ( error ) {
		console.error( error ) ;
		console.log( index ) ;
		throw error ;
	}*/
} ;

// NextGen Events once() replacement
AsyncTryCatch.ngevAddListenerOnce = function ngevAddListenerOnce( eventName , fn , options )
{
	if ( ! options ) { options = {} ; }
	if ( options.id === undefined ) { options.id = fn ; }
	
	return AsyncTryCatch.addListenerWrapper.call( this ,
		AsyncTryCatch.NextGenEvents[ this.asyncTryCatchId ].once ,
		eventName , fn , options ) ;
} ;

// NextGen Events off()/removeListener() replacement
AsyncTryCatch.ngevRemoveListener = function ngevRemoveListener( eventName , fn )
{
	return AsyncTryCatch.removeListenerWrapper.call( this ,
		AsyncTryCatch.NextGenEvents[ this.asyncTryCatchId ].off ,
		eventName , fn ) ;
} ;



AsyncTryCatch.substitute = function substitute()
{
	// This test should be done by the caller, because substitution could be incomplete
	// E.g. browser case: Node Events or NextGen Events are not loaded/accessible at time
	//if ( global.AsyncTryCatch.substituted ) { return ; }
	
	global.AsyncTryCatch.substituted = true ;
	
	global.setTimeout = AsyncTryCatch.setTimeout ;
	global.setImmediate = AsyncTryCatch.setTimeout ;
	process.nextTick = AsyncTryCatch.nextTick ;
	
	// Global is checked first, in case we are running inside a browser
	try {
		AsyncTryCatch.NodeEvents = global.EventEmitter || require( 'events' ) ;
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
	
	for ( var i = 0 ; i < AsyncTryCatch.NextGenEvents.length ; i ++ )
	{
		//console.log( 'substituting NextGenEvents' , i ) ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.on = AsyncTryCatch.ngevAddListener ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.addListener = AsyncTryCatch.ngevAddListener ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.once = AsyncTryCatch.ngevAddListenerOnce ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.off = AsyncTryCatch.ngevRemoveListener ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.removeListener = AsyncTryCatch.ngevRemoveListener ;
	}
} ;



AsyncTryCatch.restore = function restore()
{
	// This test should be done by the caller, because substitution could be incomplete
	// E.g. browser case: Node Events or NextGen Events are not loaded/accessible at time
	//if ( ! global.AsyncTryCatch.substituted ) { return ; }
	
	global.AsyncTryCatch.substituted = false ;
	
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
	
	for ( var i = 0 ; i < AsyncTryCatch.NextGenEvents.length ; i ++ )
	{
		AsyncTryCatch.NextGenEvents[ i ].prototype.on = AsyncTryCatch.NextGenEvents[ i ].on ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.addListener = AsyncTryCatch.NextGenEvents[ i ].on ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.once = AsyncTryCatch.NextGenEvents[ i ].once ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.off = AsyncTryCatch.NextGenEvents[ i ].off ;
		AsyncTryCatch.NextGenEvents[ i ].prototype.removeListener = AsyncTryCatch.NextGenEvents[ i ].removeListener ;
	}
} ;


