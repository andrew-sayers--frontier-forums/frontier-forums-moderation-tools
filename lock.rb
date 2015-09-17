#!/usr/bin/ruby
#
# Trivial web-based distributed lock manager.
#
# To get a lock:
# * GET http://<site>:1234/<path-prefix>/lock?_=<time> ("?_=..." stops caching)
# * On success the server returns lock ID
# * On failure the server returns 0
# * The lock will remain active for five seconds or until released
#
# To refresh a lock:
# * GET http://<site>:1234/<path-prefix>/refresh/<lock_id>?_=<time>
# * On success, the server returns 1
# * On failure the server returns 0
# Note: refreshing will fail if you have less than 5 seconds until the max. timeout
#
# To release a lock:
# * GET http://<site>:1234/<path-prefix>/unlock/<lock_id>?_=<time>
# * On success the server returns 1
# * On failure the server returns 0
#
# "path-prefix" is a basic security mechanism.  This source code is
# publicly available, but an attacker has to guess the path prefix
# in order to start getting locks.  Note: getting locks just lets
# you DOS other users of the service, i.e. reveal your existence.
#
#
# __NOTES FOR RE-IMPLEMENTERS__
#
# * The API above is the most important thing to copy
# * When a user requests a lock, they should only be allowed if there is no lock currently active
# * Locks should expire after a few seconds (this server holds a lock open for 5 seconds) in case browsers go away
# * Make sure to handle this case: a browser requests a lock, then its clock is reset so it keeps refreshing (or trying to unlock) long after it should have stopped
#   * refreshing a lock should only be possible for a few seconds (10 on the server)
#   * refreshing and closing a lock should only work if the correct lock ID is specified
#
#
# __NOTES FOR USERS__
#
# You will need a config file "lock.yml" that looks something like:
# config:
# 	path_prefix: ...
# 	port: ...
#
# This code was once seen binding only to localhost no matter what.
# Restarting the server fixed that issue.

require 'rack'

require 'webrick'
require 'webrick/https'
include WEBrick

require 'yaml'

lock_time = 0;
max_lock_time = 0;
lock_id = 1;

$config = {}
$path_prefix = ''
def get_config()
  $config = YAML.load_file('lock.yml')['config']
  if !$config.has_key?('path_prefix')
  then
    raise "Please set a 'path_prefix' environment variable"
  end
  if $config['path_prefix'].include?('/')
  then
    raise "Please set a path_prefix without slashes"
  end
  $path_prefix = $config['path_prefix']
end
get_config()
Signal.trap("HUP") do
  get_config()
end
Signal.trap("TERM") do
  Rack::Handler::WEBrick.shutdown
end

app = Proc.new do |env|

  path = env['PATH_INFO'].split('/')

  result = ""

  if ( path[1] == $path_prefix )
  then
    case path[2]

    when 'lock' # get a lock
      if lock_time < Time.now.to_i
      then
        if lock_time; then lock_id += 1; end # invalidate a timed-out lock
        lock_time = Time.now.to_i +  5 # acquire the lock for 5 seconds
        max_lock_time = lock_time + 10 # can refresh the lock for up to 10 more seconds
        result = "#{lock_id}"
      else
        result = "0"
      end

    when 'refresh' # "I'm still here, don't release the lock!"
      new_lock_time = Time.now.to_i + 5
      if lock_time != 0 && max_lock_time > new_lock_time && path[3] == "#{lock_id}"
      then # more than 5 seconds still available - refresh the lock
        lock_time = new_lock_time
        result = "1"
      else
        result = "0"
      end

    when 'unlock' # release the lock
      if lock_time != 0 && path[3] == "#{lock_id}"
      then
        lock_time = 0
        lock_id += 1 # so future refreshes/unlocks on this lock will fail
        result = "1"
      else
        result = "0"
      end

    when nil # so we can point people at the root URL to check the site's working
      result = "You have successfully connected to the lock server :)\n"

    end
  end

  headers = {
    'Content-Type'  => 'text/plain',
    'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
    'Cache-Control' => 'post-check=0, pre-check=0',
    'Pragma'        => 'no-cache'
  }

  if ( result == "" )
    [ '404', headers, ["Not Found.\n"] ]
  else
    [ '200', headers, [result] ]
  end

end

Rack::Handler::WEBrick.run(
    app,
    :Logger => WEBrick::Log.new("/dev/null",WEBrick::Log::FATAL),
    :AccessLog => [[File.open("/dev/null",'w'),WEBrick::AccessLog::COMBINED_LOG_FORMAT]],
    :Port => $config['port']
)
