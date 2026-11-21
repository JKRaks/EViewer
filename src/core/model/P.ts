export class P<T> {
  isSuccess: boolean = false

  data: T | undefined = undefined

  get dataOrDefault(): T {
    if (this.data !== undefined) {
      return this.data
    } else {
      return {} as T
    }
  }

  msg: string = ''

  ipRestricted?: boolean
}
