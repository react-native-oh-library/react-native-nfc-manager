
class ArrayUtils {
  intersection(arr1:number[],arr2:number[]) {
    return arr1.filter(value => arr2.includes(value));
  }
}

export const arrayUtils = new ArrayUtils();