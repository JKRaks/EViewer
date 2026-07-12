export class tagCollection {
  /** 标签命名空间，例如 female、language。 */
  collection: string = ''

  /** 当前命名空间下的标签。 */
  items: tagItem[] = []
}

export class tagItem {
  /** 标签英文原名。 */
  name: string = ''

  /** 是否为官方标签。 */
  official: boolean = false
}
