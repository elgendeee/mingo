(function(){var previousMingo,_,root=this,Mingo={};null!=root&&(previousMingo=root.Mingo),Mingo.noConflict=function(){return root.Mingo=previousMingo,Mingo},"undefined"!=typeof exports?(exports="undefined"!=typeof module&&module.exports?module.exports=Mingo:Mingo,_=require("underscore")):(root.Mingo=Mingo,_=root._);var primitives=[_.isString,_.isBoolean,_.isNumber,_.isDate,_.isNull,_.isRegExp],normalize=function(value){for(var i=0;i<primitives.length;i++)if(primitives[i](value))return _.isRegExp(value)?{$regex:value}:{$eq:value};if(_.isObject(value)){var notQuery=0===_.intersection(Ops.queryOperators,_.keys(value)).length;if(notQuery)return{$eq:value}}return value},settings={key:"_id"};Mingo.setup=function(options){_.extend(settings,options||{})},Mingo.Query=function(criteria){this._criteria=criteria,this._compiledSelectors=[],this._compile()},Mingo.Query.prototype={_compile:function(){if(!_.isEmpty(this._criteria)&&_.isObject(this._criteria))for(var name in this._criteria){var expr=this._criteria[name];if(_.contains(Ops.compoundOperators,name)){if(_.contains(["$not","$elemMatch"],name))throw Error("Invalid operator");this._processOperator(name,name,expr)}else{expr=normalize(expr);for(var operator in expr)if(!_.contains(["$options"],operator)){if("$regex"===operator){var regex=expr[operator],options=expr.$options||"",modifiers="";_.isString(regex)&&(regex=new RegExp(regex)),modifiers+=regex.ignoreCase||options.indexOf("i")>=0?"i":"",modifiers+=regex.multiline||options.indexOf("m")>=0?"m":"",modifiers+=regex.global||options.indexOf("g")>=0?"g":"",regex=new RegExp(regex.source,modifiers),expr[operator]=regex}this._processOperator(name,operator,expr[operator])}}}},_processOperator:function(field,operator,value){var compiledSelector;if(_.contains(Ops.simpleOperators,operator))compiledSelector={test:function(obj){var actualValue=Mingo._resolve(obj,field);return simpleOperators[operator](actualValue,value)}};else{if(!_.contains(Ops.compoundOperators,operator))throw Error("Invalid query operator '"+operator+"' detected");compiledSelector=compoundOperators[operator](field,value)}this._compiledSelectors.push(compiledSelector)},test:function(model){for(var match=!0,i=0;i<this._compiledSelectors.length;i++){var compiled=this._compiledSelectors[i];if(match=compiled.test(model),match===!1)break}return match},find:function(collection,projection){return new Mingo.Cursor(collection,this,projection)},remove:function(collection){for(var arr=[],i=0;i<collection.length;i++)this.test(collection[i])===!1&&arr.push(collection[i]);return arr}},Mingo.Cursor=function(collection,query,projection){this._query=query,this._collection=collection,this._projection=projection,this._operators={},this._result=!1,this._position=0},Mingo.Cursor.prototype={_fetch:function(){var self=this;if(this._result===!1){if(_.isObject(this._projection)&&_.extend(this._operators,{$project:this._projection}),!_.isArray(this._collection))throw Error("Input collection is not of a valid type.");this._result=_.filter(this._collection,this._query.test,this._query);var pipeline=[];if(_.each(["$sort","$skip","$limit","$project"],function(op){_.has(self._operators,op)&&pipeline.push(_.pick(self._operators,op))}),pipeline.length>0){var aggregator=new Mingo.Aggregator(pipeline);this._result=aggregator.run(this._result)}}return this._result},all:function(){return this._fetch()},first:function(){return this.count()>0?this._fetch()[0]:null},last:function(){return this.count()>0?this._fetch()[this.count()-1]:null},count:function(){return this._fetch().length},skip:function(n){return _.extend(this._operators,{$skip:n}),this},limit:function(n){return _.extend(this._operators,{$limit:n}),this},sort:function(modifier){return _.extend(this._operators,{$sort:modifier}),this},next:function(){return this.hasNext()?this._fetch()[this._position++]:!1},hasNext:function(){return this.count()>this._position},max:function(expr){return groupOperators.$max(this._fetch(),expr)},min:function(expr){return groupOperators.$min(this._fetch(),expr)},map:function(callback){return _.map(this._fetch(),callback)},forEach:function(callback){_.each(this._fetch(),callback)}},Mingo.Aggregator=function(operators){this._operators=operators},Mingo.Aggregator.prototype={run:function(collection){if(!_.isEmpty(this._operators))for(var i=0;i<this._operators.length;i++){var operator=this._operators[i];for(var key in operator)collection=pipelineOperators[key](collection,operator[key])}return collection}},Mingo._get=function(obj,field){return _.result(obj,field)},Mingo._resolve=function(obj,field){if(!field)return void 0;for(var isText,names=field.split("."),value=obj,i=0;i<names.length;i++){if(isText=null===names[i].match(/^\d+$/),isText&&_.isArray(value)){for(var n=names.slice(i).join("."),res=[],j=0;j<value.length;j++)_.isObject(value[j])&&res.push(Mingo._get(value[j],n));value=res}else value=Mingo._get(value,names[i]);if(void 0===value)break}return value},Mingo.compile=function(criteria){return new Mingo.Query(criteria)},Mingo.find=function(collection,criteria,projection){return new Mingo.Query(criteria).find(collection,projection)},Mingo.remove=function(collection,criteria){return new Mingo.Query(criteria).remove(collection)},Mingo.aggregate=function(collection,pipeline){return _.isArray(pipeline)||(pipeline=_.toArray(arguments).splice(1)),new Mingo.Aggregator(pipeline).run(collection)},Mingo.CollectionMixin={query:function(criteria,projection){return Mingo.find(this.toJSON(),criteria,projection)},aggregate:function(pipeline){_.isArray(pipeline)||(pipeline=_.toArray(arguments).splice(0));var args=[this.toJSON()];return Array.prototype.push.apply(args,pipeline),Mingo.aggregate.apply(null,args)}};var pipelineOperators={$group:function(collection,expr){var idKey=expr[settings.key],indexes=[],groups=_.groupBy(collection,function(obj){var key=computeValue(obj,idKey,idKey);return indexes.push(key),key});indexes=_.uniq(indexes),expr=_.omit(expr,settings.key);var result=[];return _.each(indexes,function(index){var obj={};obj[settings.key]=index;for(var key in expr)obj[key]=accumulate(groups[index],key,expr[key]);result.push(obj)}),result},$match:function(collection,expr){var query=new Mingo.Query(expr);return query.find(collection).all()},$project:function(collection,expr){var whiteList=[],blacklist=[];for(var key in expr){var obj=expr[key];if(0===obj||obj===!1){if(key!==settings.key)throw new Error("The top-level _id field is the only field currently supported for exclusion");blacklist.push(key)}else(1===obj||obj===!0||_.isString(obj)||_.isObject(obj))&&whiteList.push(key)}if(0!==blacklist.length||_.contains(whiteList,settings.key)||(whiteList.push(settings.key),expr[settings.key]=1),0===whiteList.length)throw new Error("$projection requires at least one output field");for(var record,objKeys,temp,cloneObj,projected=[],i=0;i<collection.length;i++)record=collection[i],objKeys=_.keys(record),cloneObj={},_.each(whiteList,function(key){var subExpr=expr[key];_.isString(subExpr)||_.isObject(subExpr)?(temp=computeValue(record,subExpr),cloneObj[key]=temp):(1===subExpr||subExpr===!0)&&(temp=computeValue(record,key),cloneObj[key]=temp)}),projected.push(cloneObj);return projected},$limit:function(collection,value){return _.first(collection,value)},$skip:function(collection,value){return _.rest(collection,value)},$unwind:function(collection,expr){for(var result=[],field=expr.substr(1),i=0;i<collection.length;i++){var obj=collection[i],value=Mingo._get(obj,field);if(!_.isArray(value))throw new Error("Target field '"+field+"' is not of type Array.");_.each(value,function(item){var tmp=_.clone(obj);tmp[field]=item,result.push(tmp)})}return result},$sort:function(collection,sortKeys){if(!_.isEmpty(sortKeys)&&_.isObject(sortKeys)){var modifiers=_.keys(sortKeys);modifiers.reverse().forEach(function(key){var indexes=[],grouped=_.groupBy(collection,function(obj){var value=Mingo._resolve(obj,key);return indexes.push(value),value});indexes=_.uniq(indexes);var indexes=_.sortBy(indexes,function(item){return item});-1===sortKeys[key]&&indexes.reverse(),collection=[],_.each(indexes,function(item){Array.prototype.push.apply(collection,grouped[item])})})}return collection}},compoundOperators={$and:function(selector,value){if(!_.isArray(value))throw new Error("Invalid expression for $and criteria");var queries=[];return _.each(value,function(expr){queries.push(new Mingo.Query(expr))}),{test:function(obj){for(var i=0;i<queries.length;i++)if(queries[i].test(obj)===!1)return!1;return!0}}},$or:function(selector,value){if(!_.isArray(value))throw new Error("Invalid expression for $or criteria");var queries=[];return _.each(value,function(expr){queries.push(new Mingo.Query(expr))}),{test:function(obj){for(var i=0;i<queries.length;i++)if(queries[i].test(obj)===!0)return!0;return!1}}},$nor:function(selector,value){if(!_.isArray(value))throw new Error("Invalid expression for $nor criteria");var query=this.$or("$or",value);return{test:function(obj){return!query.test(obj)}}},$not:function(selector,value){var criteria={};criteria[selector]=normalize(value);var query=new Mingo.Query(criteria);return{test:function(obj){return!query.test(obj)}}},$elemMatch:function(selector,value){var criteria={};criteria[selector]=normalize(value);var query=new Mingo.Query(criteria);return{test:function(obj){var arr=Mingo._resolve(obj,selector);if(_.isUndefined(arr)||!_.isArray(arr))return!1;for(var i=0;i<arr.length;i++)if(!query.test(arr[i]))return!1;return!0}}},$where:function(){throw Error("$where is Bad Bad Bad and SHALL NOT be implemented! Sorry :(")}},simpleOperators={$eq:function(a,b){return a=_.isArray(a)?a:[a],a=_.find(a,function(val){return _.isEqual(val,b)}),void 0!==a},$ne:function(a,b){return!this.$eq(a,b)},$in:function(a,b){return a=_.isArray(a)?a:[a],_.intersection(a,b).length>0},$nin:function(a,b){return _.isUndefined(a)||!this.$in(a,b)},$lt:function(a,b){return a=_.isArray(a)?a:[a],a=_.find(a,function(val){return b>val}),void 0!==a},$lte:function(a,b){return a=_.isArray(a)?a:[a],a=_.find(a,function(val){return b>=val}),void 0!==a},$gt:function(a,b){return a=_.isArray(a)?a:[a],a=_.find(a,function(val){return val>b}),void 0!==a},$gte:function(a,b){return a=_.isArray(a)?a:[a],a=_.find(a,function(val){return val>=b}),void 0!==a},$mod:function(a,b){return a=_.isArray(a)?a:[a],a=_.find(a,function(val){return _.isNumber(val)&&_.isArray(b)&&2===b.length&&val%b[0]===b[1]}),void 0!==a},$regex:function(a,b){return a=_.isArray(a)?a:[a],a=_.find(a,function(val){return _.isString(val)&&_.isRegExp(b)&&!!val.match(b)}),void 0!==a},$exists:function(a,b){return b===!1&&_.isUndefined(a)||b===!0&&!_.isUndefined(a)},$all:function(a,b){return _.isArray(a)&&_.isArray(b)?_.intersection(b,a).length===b.length:!1},$size:function(a,b){return _.isArray(a)&&_.isNumber(b)&&a.length===b}},groupOperators={$addToSet:function(collection,expr){var result=_.map(collection,function(obj){return computeValue(obj,expr)});return _.uniq(result)},$sum:function(collection,expr){if(_.isNumber(expr))return collection.length*expr;var result=_.reduce(collection,function(acc,obj){return acc+computeValue(obj,expr)},0);return result},$max:function(collection,expr){var obj=_.max(collection,function(obj){return computeValue(obj,expr)});return computeValue(obj,expr)},$min:function(collection,expr){var obj=_.min(collection,function(obj){return computeValue(obj,expr)});return computeValue(obj,expr)},$avg:function(collection,expr){return this.$sum(collection,expr)/collection.length},$push:function(collection,expr){return _.map(collection,function(obj){return computeValue(obj,expr)})},$first:function(collection,expr){return collection.length>0?computeValue(collection[0],expr):void 0},$last:function(collection,expr){return collection.length>0?computeValue(collection[collection.length-1],expr):void 0}},aggregateOperators={$add:function(ctx){var result=0,values=_.toArray(arguments).slice(1)[0];return flatten(ctx,values,function(val){result+=val}),result},$subtract:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args[0]-args[1]},$divide:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args[0]/args[1]},$multiply:function(ctx){var values=_.toArray(arguments).slice(1)[0],result=1;return flatten(ctx,values,function(val){result*=val}),result},$mod:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args[0]%args[1]},$cmp:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args[0]>args[1]?1:args[0]<args[1]?-1:0},$concat:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args.join("")},$strcasecmp:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args[0]=args[0].toUpperCase(),args[1]=args[1].toUpperCase(),args[0]>args[1]?1:args[0]<args[1]?-1:0},$substr:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args[0].substr(args[1],args[2])},$toLower:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args[0].toLowerCase()},$toUpper:function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);return args[0].toUpperCase()}};_.each(["$eq","$ne","$gt","$gte","$lt","$lte"],function(op){aggregateOperators[op]=function(ctx){var values=_.toArray(arguments).slice(1)[0],args=flatten(ctx,values);simpleOperators[op](args[0],args[1])}});var Ops={simpleOperators:_.keys(simpleOperators),compoundOperators:_.keys(compoundOperators),aggregateOperators:_.keys(aggregateOperators),groupOperators:_.keys(groupOperators),pipelineOperators:_.keys(pipelineOperators)};Ops.queryOperators=_.union(Ops.simpleOperators,Ops.compoundOperators);var flatten=function(obj,args,action){for(var i=0;i<args.length;i++)_.isString(args[i])&&args[i].length>0&&(args[i]=computeValue(obj,args[i])),"function"==typeof action&&action(args[i]);return args},accumulate=function(collection,field,expr){if(_.contains(Ops.groupOperators,field))return groupOperators[field](collection,expr);if(_.isObject(expr)){var result={};for(var key in expr)if(result[key]=accumulate(collection,key,expr[key]),_.contains(Ops.groupOperators,key)){if(result=result[key],_.keys(expr).length>1)throw new Error("Invalid $group expression '"+JSON.stringify(expr)+"'");break}return result}return null},computeValue=function(record,expr,field){if(_.isString(expr)&&expr.length>0){var str="$"===expr[0]?expr.slice(1):expr;return Mingo._resolve(record,str)}if(_.contains(Ops.aggregateOperators,field))return aggregateOperators[field](record,expr);if(_.isObject(expr)){var result={};for(var key in expr)if(result[key]=computeValue(record,expr[key],key),_.contains(Ops.aggregateOperators,key)){if(result=result[key],_.keys(expr).length>1)throw new Error("Invalid aggregation expression '"+JSON.stringify(expr)+"'");break}return result}for(var i=0;i<primitives.length;i++)if(primitives[i](expr))return expr;return void 0}}).call(this);