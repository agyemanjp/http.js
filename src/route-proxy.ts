/* eslint-disable fp/no-rest-parameters */
/* eslint-disable fp/no-mutating-assign */
/* eslint-disable indent */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable fp/no-proxy */
/* eslint-disable fp/no-unused-expression */
/* eslint-disable no-shadow */
// import * as express from 'express'
import { keys, Obj, pick } from '@agyemanjp/standard'

import { JsonObject, statusCodes, Method as HttpMethod, applyParams, ParamsObj, Json, AcceptType, BodyMethod, QueryMethod } from "./common"
import { request, TResponse, ResponseDataType } from './client'


/** Fluent body route factory */
export function bodyFactory<M extends BodyMethod>(method: Lowercase<M>) {
	return {
		url: <Url extends string>(url: Url) => ({
			bodyType: <Bdy extends Json>() => ({
				headersType: <Hdrs extends sJson>() => ({
					returnType: <Ret extends Json | null>() => {
						type Args = ParamsObj<Url> & Bdy & Hdrs
						const proxyFactory: ProxyFactory<Args, Ret> = (baseUrl, argsInjected) => {
							const urlEffective = applyParams(`${baseUrl}/${url}`, argsInjected)
							return async (args: Omit<Args, keyof typeof argsInjected>) => request[method]<Wrap<Ret>>({
								url: urlEffective,
								...parseBodyArgs(urlEffective, { ...args, ...argsInjected }),
								accept: "Json"
							}).then(wrapped => {
								if ("data" in wrapped)
									return wrapped.data
								else
									throw wrapped.error
							})
						}
						return Object.assign(proxyFactory("", {}),
							{
								method,
								url,
								proxyFactory,
								route: (handlerFn: Proxy<Args, Ret>) => ({
									method,
									url,
									handler: jsonHandler(handlerFn, true)
								})
							} //as ProxyFactoryAugmented<Args, Ret, M>,
						)
					},
					responseType: <Accept extends AcceptType>(accept: Accept) => {
						type Args = ParamsObj<Url> & Bdy & Hdrs
						const proxyFactory: ProxyFactory<Args, TResponse<Accept>> = (baseUrl, argsInjected) => {
							const urlEffective = applyParams(`${baseUrl}/${url}`, argsInjected)
							return async (args: Omit<Args, keyof typeof argsInjected>) => request[method]({
								url: urlEffective,
								...parseBodyArgs(urlEffective, { ...args, ...argsInjected }),
								accept
							})
						}
						return Object.assign(proxyFactory("", {}),
							{
								proxyFactory,
								// proxy: proxyFactory("", {}),
								method,
								url,
								route: (handlerFn: Proxy<Args, TResponse<Accept>>) => ({
									method,
									url,
									handler: jsonHandler(handlerFn, true)
								})
							}
						)
					}
				})
			})
		})
	}
}

/** Fluent query route factory */
export function queryFactory<M extends QueryMethod>(method: Lowercase<M>) {
	return {
		url: <Url extends string>(url: Url) => ({
			queryType: <Qry extends sJson>() => ({
				headersType: <Hdrs extends sJson>() => ({
					returnType: <Ret extends Json | null>() => {
						type Args = ParamsObj<Url> & Qry & Hdrs
						const proxyFactory: ProxyFactory<Args, Ret> = (baseUrl, argsInjected) => {
							const urlEffective = applyParams(`${baseUrl}/${url}`, argsInjected)
							return async (args: Omit<Args, keyof typeof argsInjected>) => request[method]<Wrap<Ret>>({
								url: urlEffective,
								...parseQueryArgs(urlEffective, { ...args, ...argsInjected }),
								accept: "Json"
							}).then(wrapped => {
								if ("data" in wrapped)
									return wrapped.data
								else
									throw wrapped.error
							})
						}
						return Object.assign(proxyFactory("", {}),
							{
								proxyFactory,
								method,
								url,
								route: (handlerFn: Proxy<Args, Ret>) => ({
									method,
									url,
									handler: jsonHandler(handlerFn, true)
								})
							}
						)
					},
					responseType: <Accept extends AcceptType>(accept: Accept) => {
						type Args = ParamsObj<Url> & Qry & Hdrs
						const proxyFactory: ProxyFactory<Args, TResponse<Accept>> = (baseUrl, argsInjected) => {
							const urlEffective = applyParams(`${baseUrl}/${url}`, argsInjected)
							return async (args: Omit<Args, keyof typeof argsInjected>) => request[method]({
								url: urlEffective,
								...parseQueryArgs(urlEffective, { ...args, ...argsInjected }),
								accept
							})
						}
						return Object.assign(proxyFactory("", {}),
							{
								proxyFactory,
								method,
								url,
								route: (handlerFn: Proxy<Args, TResponse<Accept>>) => ({
									method,
									url,
									handler: jsonHandler(handlerFn, true)
								})
							}
						)
					}
				})
			})
		})
	}
}

/** Create handler accepting typed JSON data (in query, params, header, and/or body) and returning JSON data */
export function jsonHandler<QryHdrsBdy, Ret>(fn: (req: QryHdrsBdy & RequestUrlInfo) => Promise<Ret>, wrap = false)/*: express.Handler*/ {
	return async (req:
		{
			body: QryHdrsBdy & RequestUrlInfo;
			query: QryHdrsBdy & RequestUrlInfo;
			headers: QryHdrsBdy & RequestUrlInfo;
			params: QryHdrsBdy & RequestUrlInfo;
			url: any;
			baseUrl: any;
			originalUrl: any
		},
		res:
			{
				status: (arg0: number) => {
					(): any; new(): any;
					json: { (arg0: Awaited<Ret> | { data: Awaited<Ret> }): void; new(): any };
					send: { (arg0: unknown): void; new(): any }
				}
			}) => {
		try {
			const r = await fn({
				...req.body,
				...req.query,
				...req.headers,
				...req.params,
				url: req.url,
				baseUrl: req.baseUrl,
				originalUrl: req.originalUrl
			})
			res.status(statusCodes.OK).json(wrap ? { data: r } : r)
		}
		catch (err) {
			res.status(statusCodes.INTERNAL_SERVER_ERROR).send(wrap ? { error: err } : err)
		}
	}
}

/** Creates a client route based on a server route */
export function clientProxy<Mthd extends HttpMethod, QryHdrsBdyParams extends Json, Ret extends Json, A extends Partial<QryHdrsBdyParams>>(
	// route: RouteObject<Mthd, QryHdrsBdyParams, Ret>,
	proxyFactoryAumented: ProxyFactoryAugmented<QryHdrsBdyParams, Ret, Mthd>,
	baseUrl: string,
	injectedArgs: A
) {

	const proxy = proxyFactoryAumented.proxyFactory(baseUrl, injectedArgs)
	const proxtFactoryAug = Object.assign(proxy, {
		method: proxyFactoryAumented.method,
		url: applyParams(proxyFactoryAumented.url, injectedArgs),
		proxyFactory: ((baseUrlNew, argsNew) => {
			const mergedArgs = { ...argsNew, ...injectedArgs } as Partial<QryHdrsBdyParams>
			return proxyFactoryAumented.proxyFactory(`${baseUrlNew}/${baseUrl}`, mergedArgs)
		}) as ProxyFactory<Omit<QryHdrsBdyParams, keyof A>, Ret>,
	}) //as ProxyFactoryAugmented<Omit<QryHdrsBdyParams, keyof A>, Ret, Mthd>

	return Object.assign(proxtFactoryAug, {
		handler: jsonHandler(proxy)
	})
}

export type RouteObject<Mthd extends string = string, Hndlr extends Handler = Handler> = {
	method: Mthd;
	url: string;
	handler: Hndlr;
}
export type RouteTriple<Mthd extends string = string, Hndlr extends Handler = Handler> = [
	method: Mthd,
	url: string,
	handler: Hndlr
]

export type QueryProxy<Url extends string, Qry extends sJson, Hdrs extends sJson, Ret extends ResponseDataType> = (
	(args: ParamsObj<Url> & Qry & Hdrs) => Promise<Ret>
)
export type BodyProxy<Url extends string, Bdy extends Json, Hdrs extends sJson, Ret extends ResponseDataType> = (
	(args: ParamsObj<Url> & Bdy & Hdrs) => Promise<Ret>
)

export type Proxy<Args extends Json, Ret extends ResponseDataType> = (args: Args) => Promise<Ret>

export type ProxyFactory<Args extends Json, Ret extends ResponseDataType> = (
	<A extends Partial<Args>>(baseUrl: string, args: A) =>
		(args: Omit<Args, keyof A>) =>
			Promise<Ret>
)

export type ProxyFactoryAugmented<Args extends Json, Ret extends ResponseDataType, M extends HttpMethod> = (
	Proxy<Args, Ret> & {
		proxyFactory: ProxyFactory<Args, Ret>;
		// proxy: Proxy<Args, Ret>;
		method: Lowercase<M>;
		url: string;
		// route: (handler: Proxy<QryHdrsBdyParams, Ret>) => RouteObject<HttpMethod>;
	})


// export type ProxyFactoryAugmented<QryHdrsBdyParams extends Json, Ret extends ResponseDataType, M extends HttpMethod> = {
// 	proxyFactory: ProxyFactory<QryHdrsBdyParams, Ret>;
// 	proxy: Proxy<QryHdrsBdyParams, Ret>;
// 	method: Lowercase<M>;
// 	url: string;
// 	// route: express.Handler
// }


/** Parse various categories of properties out of a query arguments object 
 * By conention header property names must be prefixed with an underscore _
 */
function parseQueryArgs(url: string, args: sJson) {
	return {
		query: pick(args, ...keys(args).filter(k => !url.includes(`/:${k}/`))),
		headers: pick(args, ...keys(args).filter(k => !url.includes(`/:${k}/`) && k.startsWith("_"))),
		params: pick(args, ...keys(args).filter(k => url.includes(`/:${k}/`)))
	}
}
/** Parse various categories of properties out of a body arguments object
 * By conention header property names must be prefixed with an underscore _
 */
function parseBodyArgs(url: string, _args: Json) {
	const args = _args as Obj
	return {
		body: pick(args, ...keys(args).filter(k => !url.includes(`/:${k}/`))) as Json,
		headers: pick(args, ...keys(args).filter(k => !url.includes(`/:${k}/`) && k.startsWith("_"))) as sJson,
		params: pick(args, ...keys(args).filter(k => url.includes(`/:${k}/`))) as sJson
	}
}

type RequestUrlInfo = { url: string, baseUrl: string, originalUrl: string }
type Wrap<T> = ({ data: T } | { error: string })
// type MIMETypeKey = keyof typeof MIME_TYPES
type sJson = JsonObject<string>

export type Handler = (...args: any[]) => any | Promise<any>

/*export interface RequestHandler<
	P = Obj<string>,
	ResBody = any,
	ReqBody = any,
	ReqQuery = Obj<string>,
	Locals extends Record<string, any> = Record<string, any>
	> {
	// tslint:disable-next-line callable-types (This is extended from and can't extend from a type alias in ts<2.2)
	(
		req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
		res: Response<ResBody, Locals>,
		next: NextFunction,
	): void;
}*/

/*export const routeFactory = <QryBdy extends JsonObject<string>, Url extends string, Ret>(
	proxyFactory: ProxyFactoryAugmented<QryBdy, Url, Promise<Ret>>,
	handlerFn: Proxy<QryBdy, Url, Promise<Ret>>
) => ({
	method: proxyFactory.method,
	url: proxyFactory.url,
	handler: jsonHandler(handlerFn, true),
	// handlerFactory: jsonHandler(handlerFn, true),
})*/

/*export type RouteObjectComplex<Mthd extends HttpMethod, Prms extends sJson, Hdrs extends sJson, Qry extends sJson, Bdy extends Json, Ret extends Json> = {
	method: Lowercase<Mthd>;
	url: string;
	proxy: (args: Prms & Qry & Hdrs & Bdy) => Promise<Wrap<Ret>>;
	proxyFactory: <A extends Partial<Prms & Qry & Hdrs & Bdy>>(baseUrl: string, args: A) => (args: Omit<Prms & Qry & Hdrs & Bdy, keyof A>) => Promise<Wrap<Ret>>
	handlerFactory: <Ctx>(ctx: Ctx) => express.Handler;
}*/

/*function createBodyRoute<M extends BodyMethod, P extends string, U extends string, H extends PGRepo>(route: Route<M, U, H>) {
	return {
		proxyFactory: <B extends Json, R extends Json>(baseUrl: P) => [
			...route,
			proxy[route[0].toLowerCase() as Lowercase<M>]
				.route(`${baseUrl}${route[1]}`)
				.bodyType<B>()
				.returnType<R>() as BodyProxy<B, Concat<P, U>, R>
		] as const
	}
}*/
/*function createQueryRoute<M extends QueryMethod, U extends string, H extends PGRepo, P extends string>(route: Route<M, U, H>) {
	return {
		proxyFactory: <Q extends Json<string>, R extends Json>(baseUrl: P) => ({
			...route,
			proxy: proxy[route[0].toLowerCase() as Lowercase<M>]
				.route(`${baseUrl}${route[1]}`)
				.queryType<Q>()
				.returnType<R>()
		})
	}
}*/

/*export function queryProxyFactory(method: "get" | "delete") {
	return {
		url: <Url extends string>(url: Url) => ({
			queryType: <Query extends JsonObject<string>>() => ({
				returnType: <Ret extends Json>() => {
					const factory = <BaseUrl extends string, Params extends Partial<ParamsObj<Url>>>(baseUrl: BaseUrl, params: Params) => {
						const urlEffective = `${baseUrl}/${applyParams(url, params)}`
						return async (args: Query & Omit<ParamsObj<Url>, keyof Params>) => request[method]<Ret>({
							url: urlEffective,
							...parseQueryArgs(urlEffective, args as any),
							accept: "Json"
						})
					}
					return Object.assign(factory, { proxy: factory("", {}), method, url })
				},

				responseType: <Accept extends MIMETypeKey>(accept: Accept) => {
					const factory = <BaseUrl extends string, Prm extends Partial<ParamsObj<Url>>>(baseUrl: BaseUrl, params: Prm) => {
						const urlEffective = `${baseUrl}/${applyParams(url, params)}`
						return async (args: Query & Omit<ParamsObj<Url>, keyof Prm>) => request[method]({
							url: urlEffective,
							...parseQueryArgs(urlEffective, args),
							accept
						})
					}
					return Object.assign(factory, { proxy: factory("", {}), method, url })
				}
			})

		})
	}
}
// const xx = queryProxyFactory("get").url("").queryType<{ str: string }>().returnType<{ ret: any }>()("", {})({ str: "" })

export function bodyProxyFactory(method: "post" | "put" | "patch") {
	return {
		url: <Url extends string>(url: Url) => ({
			bodyType: <Bdy extends Json>() => {
				return {
					returnType: <Ret extends Json>() => {
						const factory: ProxyFactory<Url, Bdy, Ret> = <BaseUrl extends string, Prm extends Partial<ParamsObj<Url>>>(baseUrl: BaseUrl, params: Prm) => {
							const urlEffective = `${baseUrl}/${applyParams(url, params)}`
							return async (args: Bdy & Omit<ParamsObj<Url>, keyof Prm>) => request[method]<Ret>({
								url: urlEffective,
								...parseBodyArgs(urlEffective, args as any),
								accept: "Json"
							})
						}
						return Object.assign(factory, { proxy: factory("", {}), method, url })
					},
					responseType: <Accept extends MIMETypeKey>(accept: Accept) => {
						const factory: ProxyFactory<Url, Bdy, TResponse<Accept>> = <BaseUrl extends string, Prm extends Partial<ParamsObj<Url>>>(baseUrl: BaseUrl, params: Prm) => {
							const urlEffective = `${baseUrl}/${applyParams(url, params)}`
							return async (args: Bdy & Omit<ParamsObj<Url>, keyof Prm>) => request[method]({
								url: urlEffective,
								...parseBodyArgs(urlEffective, args),
								accept
							})
						}

						return Object.assign(factory, { proxy: factory("", {}), method, url })
					}
				}
			}
		})
	}
}*/

/*export const proxyFactory = <Ret extends Json, Bdy extends Json, BaseUrl extends string, Url extends string, Prm extends Partial<ParamsObj<`${BaseUrl}/${Url}`>>>(argsFactory: {
	baseUrl: BaseUrl,
	url: Url,
	method: Lowercase<QueryMethod>,
	params: Prm
}) => {
	const { baseUrl, url, params, method } = argsFactory
	const urlEffective = applyParams(`${baseUrl}/${url}`, params)
	return async (argsProxy: Bdy & Omit<ParamsObj<Url>, keyof Prm>) => request[method]<Ret>({
		url: urlEffective,
		...parseArgs(urlEffective, argsProxy as any, "body"),
		accept: "Json"
	})
}*/

// const proxyGet = proxy.get.route("/projects/:api").queryType<{ category: string }>().responseType("Text")
// const g = proxyGet({ category: "cat", api: "nxthaus" })
// const proxyPost = proxy.post.route("/projects/:api").bodyType<{ category: string }>().returnType<{ x: number }>()
// const p = proxyPost({ category: "cat", api: "nxthaus" })

/*export function bodyProxyFactory__(method: "post" | "put" | "patch") {
	return {
		url: <Url extends string>(url: Url) => ({
			bodyType: <Bdy extends BodyType>() => {
				return {
					returnType: <Ret extends Json>() => {
						const factory = <BaseUrl extends string, Prm extends Partial<Params<`${BaseUrl}/${Url}`>>>(baseUrl: BaseUrl, params: Prm) => {
							const urlEffective = applyParams(`${baseUrl}/${url}`, params)
							return async (args: Bdy & Omit<Params<Url>, keyof Prm>) => request[method]<Ret>({
								url: urlEffective,
								...parseArgs(urlEffective, args, "body"),
								accept: "Json"
							})
						}
						return Object.assign(factory, { proxy: factory("", {}), method, url })
					},
					responseType: <Accept extends MIMETypeKey>(accept: Accept) => {
						const factory = <BaseUrl extends string, Prm extends Partial<Params<`${BaseUrl}/${Url}`>>>(baseUrl: BaseUrl, params: Prm) => {
							const urlEffective = applyParams(`${baseUrl}/${url}`, params)
							return async (args: Bdy & Params<Url>) => request[method]({
								url: urlEffective,
								...parseArgs(urlEffective, args, "body"),
								accept
							})
						}
						return Object.assign(factory, { proxy: factory("", {}), method, url })
					}
				}
			}
		})
	}
}*/

/** Fluent proxy factory */
/* export const proxy = {
	get: queryProxy("get"),
	delete: queryProxy("delete"),
	post: bodyProxy("post"),
	patch: bodyProxy("patch"),
	put: bodyProxy("put"),
}*/

/** Fluent query-based proxy factory */
/*export function queryProxy(method: "get" | "delete") {
	return {
		route: <Route extends string>(url: Route) => ({
			queryType: <Query extends Json<string>>() => ({
				returnType: <Res extends Json>() =>
					async (args: Query & Params<Route>) =>
						request[method]<Res>({ url, ...parseArgs(url, args, "query"), accept: "Json" }),
				responseType: <Accept extends MIMETypeKey>(accept: Accept) =>
					async (args: Query & Params<Route>) =>
						request[method]({ url, ...parseArgs(url, args, "query"), accept })
			}),
			headersType: <Headers extends Json<string>>() => ({
				returnType: <Ret extends Json>() =>
					async (args: Headers & Params<Route>) =>
						request[method]<Ret>({ url, ...parseArgs(url, args, "headers"), accept: "Json" }),
				responseType: <Accept extends MIMETypeKey>(accept: Accept) =>
					async (args: Headers & Params<Route>) =>
						request[method]({ url, ...parseArgs(url, args, "headers"), accept })
			})
		})
	}
}*/

/** Fluent body-based proxy factory */
/*export function bodyProxy(method: "post" | "put" | "patch") {
	return {
		route: <Route extends string>(url: Route) => ({
			bodyType: <Bdy extends BodyType>() => ({
				returnType: <Ret extends Json>() =>
					async (args: Bdy & Params<Route>) =>
						request[method]<Ret>({ url, ...parseArgs(url, args, "body"), accept: "Json" }),
				responseType: <Accept extends MIMETypeKey>(accept: Accept) =>
					async (args: Bdy & Params<Route>) =>
						request[method]({ url, ...parseArgs(url, args, "body"), accept })
			})
		})
	}
}*/


/*export type BodyProxy<Bdy extends Json, Url extends string, Ret, Prm extends Partial<ParamsObj<Url>> = ObjEmpty> =
	(args: Bdy & Omit<ParamsObj<Url>, keyof Prm>) => Ret

export type QueryProxy<Qry extends JsonObject<string>, Url extends string, Ret, Prm extends Partial<ParamsObj<Url>> = ObjEmpty> =
	(args: Qry & Omit<ParamsObj<Url>, keyof Prm>) => Ret
*/

/*export function parseArgs<R extends string, Q extends JsonObject<string>>(url: R, args: Q & ParamsObj<R>, kind: "query"): { query: Q, heasers: params: ParamsObj<R> }
export function parseArgs<R extends string, H extends JsonObject<string>>(url: R, args: H & ParamsObj<R>, kind: "headers"): { headers: H, params: ParamsObj<R> }
export function parseArgs<R extends string, B extends JsonObject>(url: R, args: B & ParamsObj<R>, kind: "body"): { body: B, params: ParamsObj<R> }
export function parseArgs<R extends string, T extends JsonObject<string>>(url: R, args: T & ParamsObj<R>, kind: "query" | "headers" | "body") {
	return {
		[kind]: pick(args, ...keys(args).filter(k => !url.includes(`/:${k}/`))) as any,
		params: pick(args, ...keys(args).filter(k => url.includes(`/:${k}/`))) as any as ParamsObj<R>
	}
}*/

// eslint-disable-next-line fp/no-let, init-declarations, @typescript-eslint/no-unused-vars
/*let e: EndpointFinal<"GET", Omit<ExtractParams<`${"BaseUrl"}/${"/:Route"}`>, keyof {}>, { x: number }>
const verify = endpoint
	.post
	.url("/:app/verify")
	.bodyType<{ emailAddress: string, verificationCode: string, accessLevel: number }>()
	.returnType<User>()
	.handler<{ getAsync: Function }>(db => (async (args) => {
		const { emailAddress, verificationCode, accessLevel } = args
		const users = await db.getAsync("users", {
			filters: [
				{ fieldName: "emailAdress", operator: "equals", value: emailAddress },
				{ fieldName: "verificationCode", operator: "equals", value: verificationCode }
			]
		})
		console.log(`Users matching verification found: ${stringify(users)}`)

		if (users.length > 0) {
			const updatedUser = {
				...users[0],
				whenVerified: Date.now(),
				...(accessLevel ? { accessLevel: accessLevel } : {}
				)
			} as User
			await db.updateAsync("usersReadonly", updatedUser)
			return sanitizeUser(updatedUser)
		}
		else {
			throw (statusCodes.NOT_FOUND.toString())
		}
	}))

const { method, route, handlerFactory, proxyFactory } = verify
const verifyClient = clientEndpoint(verify, "authURL", { app: "" })
type User = {
	id: string,
	displayName: string,
	emailAddress: string,
	companyName: string,
	accessLevel: number,
	whenVerified?: number,
	app: string
}
*/

/** Fluent route factory */
/*export const route = {
	get: queryRoute("get"),
	delete: queryRoute("delete"),
	post: bodyRoute("post"),
	patch: bodyRoute("patch"),
	put: bodyRoute("put"),
}*/

// /** Fluent body-based route factory */
/*export function bodyRoute<M extends Lowercase<BodyMethod>>(method: M) {
	return {
		url: <Url extends string>(url: Url) => ({
			bodyType: <Body extends Json>() => ({
				returnType: <Ret extends Json>() => ({
					handler: (fn: BodyProxy<Body, Url, Promise<Ret>>) => ({
						proxyFactory: <BaseUrl extends string, Prm extends Partial<Params<`${BaseUrl}/${Url}`>>>(baseUrl: BaseUrl, params: Prm) =>
							proxy[method.toLowerCase() as Lowercase<BodyMethod>]
								.route(applyParams(`${baseUrl}/${url}`, params))
								.bodyType<Body>()
								.returnType<Wrap<Ret>>() as BodyProxy<Body, `${BaseUrl}/${Url}`, Promise<Wrap<Ret>>, Prm>,
						handler: jsonHandler(fn, true),
						url,
						method,
					})
				})
			})
		})
	}
}*/
/** Fluent query-based endpoint factory */
/*export function queryRoute<M extends Lowercase<QueryMethod>>(method: M) {
	return {
		url: <Url extends string>(url: Url) => ({
			queryType: <Query extends Json<string>>() => ({
				returnType: <Ret extends Json>() => ({
					handler: (fn: QueryProxy<Query, Url, Promise<Ret>>) => ({
						method,
						url,
						handler: jsonHandler(fn, true ),
						proxyFactory: <BaseUrl extends string, Prm extends Partial<Params<`${BaseUrl}/${Url}`>>>(baseUrl: BaseUrl, params: Prm) =>
							proxy[method.toLowerCase() as Lowercase<QueryMethod>]
								.route(applyParams(`${baseUrl}/${url}`, params))
								.queryType<Query>()
								.returnType<Wrap<Ret>>() as QueryProxy<Query, `${BaseUrl}/${Url}`, Promise<Wrap<Ret>>, Prm>
					})
				})
			}),
			headersType: <Headers extends Json<string>>() => ({
				returnType: <Ret extends Json>() => ({
					handler: (fn: QueryProxy<Headers, Url, Promise<Ret>>) => ({
						method,
						url,
						handler: jsonHandler(fn, true),
						proxyFactory: <BaseUrl extends string, Prm extends Partial<Params<`${BaseUrl}/${Url}`>>>(baseUrl: BaseUrl, params: Prm) =>
							proxy[method.toLowerCase() as Lowercase<QueryMethod>]
								.route(applyParams(`${baseUrl}/${url}`, params))
								.headersType<Headers>()
								.returnType<Wrap<Ret>>() as QueryProxy<Headers, `${BaseUrl}/${Url}`, Promise<Wrap<Ret>>, Prm>
					})
				})
			})
		})
	}
}*/
