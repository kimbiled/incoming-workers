export function classNames(...arr: Array<string | false | undefined | null>) {
  return arr.filter(Boolean).join(' ');
}
