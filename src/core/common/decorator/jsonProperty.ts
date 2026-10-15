import 'reflect-metadata'

export class jsonClass {
  private static JSON_PROPERTY_KEY: string = 'jsonProperty'
  private static PROPERTIES_LIST_KEY: string = 'jsonProperties'

  static property(propertyName?: string) {
    return function (target: any, propertyKey: string) {
      const jsonKey = propertyName || propertyKey

      // 存储属性的 JSON 映射名
      Reflect.defineMetadata(jsonClass.JSON_PROPERTY_KEY, jsonKey, target, propertyKey)

      // 收集所有被装饰的属性名
      const existingProperties: string[] =
        Reflect.getMetadata(jsonClass.PROPERTIES_LIST_KEY, target) || []

      if (!existingProperties.includes(propertyKey)) {
        existingProperties.push(propertyKey)
        Reflect.defineMetadata(jsonClass.PROPERTIES_LIST_KEY, existingProperties, target)
      }
    }
  }

  // 获取单个属性的 JSON 键名
  static getJsonPropertyName(target: any, propertyKey: string): string | undefined {
    return Reflect.getMetadata(jsonClass.JSON_PROPERTY_KEY, target, propertyKey)
  }

  // 获取所有被装饰的属性名列表
  static getJsonProperties(target: any): string[] {
    return Reflect.getMetadata(jsonClass.PROPERTIES_LIST_KEY, target) || []
  }

  // 序列化对象
  static serialize(obj: any): Record<string, any> {
    const result: Record<string, any> = {}
    const target = Object.getPrototypeOf(obj)
    const shouldSerializeProperty = obj?.shouldSerializeProperty

    // 获取所有被装饰的属性
    const properties = jsonClass.getJsonProperties(target)

    for (const propertyKey of properties) {
      // 获取 JSON 键名
      const jsonKey = jsonClass.getJsonPropertyName(target, propertyKey)

      const shouldSerialize =
        typeof shouldSerializeProperty === 'function'
          ? shouldSerializeProperty.call(obj, propertyKey, jsonKey, obj[propertyKey])
          : true

      if (jsonKey && shouldSerialize && obj[propertyKey] !== undefined) {
        result[jsonKey] = obj[propertyKey]
      }
    }

    return result
  }
}
