# TOC
   - [Async Try Catch](#async-try-catch)
<a name=""></a>
 
<a name="async-try-catch"></a>
# Async Try Catch
Sync.

```js
asyncTry( function() {
	throw new Error( 'sync error' ) ;
} )
.catch( function( error ) {
	expect( error.message ).to.be( 'sync error' ) ;
} ) ;
```

Async: setTimeout.

```js
asyncTry( function() {
	setTimeout( function() {
		throw new Error( 'setTimeout error' ) ;
	} , 0 ) ;
} )
.catch( function( error ) {
	expect( error.message ).to.be( 'setTimeout error' ) ;
	done() ;
} ) ;
```

Async: double setTimeout.

```js
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
```

Async: quintuple setTimeout.

```js
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
```

Async: double setTimeout, double async try catch, throw from the inner catch should bubble up to the outer catch.

```js
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
			throw new Error( 'outer setTimeout error' ) ;
		} ) ;
	} , 0 ) ;
} )
.catch( function outerCatch( error ) {
	expect( error.message ).to.be( 'outer setTimeout error' ) ;
	//console.log( 'outer' , AsyncTryCatch.stack ) ;
	done() ;
} ) ;
```

