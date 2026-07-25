import { httpClass, type HttpRequestOptions } from '@/core/common/httpClass'
import { bookInput } from '@/core/model/book/bookInput'
import { bookOutput } from '@/core/model/book/bookOutput'
import { gallerySimilaritySearchInput } from '@/core/model/book/galleryFileSearchInput'
import { bookListBusi } from './bookListBusi'

const maxFileBytes = 15 * 1024 * 1024

export class galleryFileSearchBusi {
  /**
   * Input: 浏览器可读取的图片文件。
   * Output: 以图片 SHA-1 精确匹配得到的画册列表。
   */
  async searchExact(file: File, options: HttpRequestOptions = {}): Promise<bookOutput> {
    this.validateFile(file)
    const digest = await crypto.subtle.digest('SHA-1', await file.arrayBuffer())
    const input = new bookInput()
    input.fileHash = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
    return new bookListBusi().getBookPageList(input, options)
  }

  /**
   * Input: 图片、是否包含近似结果、是否只匹配封面及上传进度配置。
   * Output: 源站图片识别返回的画册列表。
   */
  async searchSimilar(
    input: gallerySimilaritySearchInput,
    options: HttpRequestOptions = {},
  ): Promise<bookOutput> {
    this.validateFile(input.file)
    const response = await httpClass.sendRequest(input, options)
    if (!response.isSuccess || !response.data) {
      const result = new bookOutput()
      result.data = []
      result.msg = response.msg || '图片搜索失败'
      return result
    }
    return new bookListBusi().parseBookPageHtml(response.data)
  }

  private validateFile(file: File) {
    if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
    if (file.size > maxFileBytes) throw new Error('图片不能超过 15 MB')
    if (!file.size) throw new Error('图片内容为空')
  }
}
